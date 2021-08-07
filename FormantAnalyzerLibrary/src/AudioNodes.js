
//Handles the Audio Contexts, Plot configuration and loading, main plotting functions are in './plotter.js', main segmenting functions are in 'segmentor.js'

const segmentor = require('./segmentor.js');
const plotter = require('./plotter.js');
const AnalyzerWorklet_link = 'https://unpkg.com/formantanalyzer@1.1.6/analyzernode.min.js';
//AudioWorklet module responsible for FFT and Mel Spectrum calculations in realtime, it is the heaviest process as it has many 'for loops' for each frame.

//Generalized function for AudioContext in new and old browser
window.AudioContext = (function(){
    return  window.webkitAudioContext || window.AudioContext || window.mozAudioContext;
})();

//This variable keeps track of audio frames while playing
var running = {audioPlaying: 0, PlayMode: 0, last_node_ms: 0, frames_ack: 0, frames_analyzed: 0, spec_bands: -1};

//These settings are sent to a worklet node in 'analyzernode.main.js' which runs in a separate thread
var analyzer_config = {spec_type: 1, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25,  pre_norm_gain: 1000, high_f_emph:0.05};

//These settings are set by reset_plot() and used by animate() 
var plot_config = {plot_enable: false, spec_type: 1, process_level: 4, plot_len: 500, bins_count: 128,  bins_y_labels: [], axis_labels_sep: 3, last_seg_len:0, plot_lag:3};



export function reset_nodes(spec_type, f_min, f_max, N_fft_bins, N_mel_bins, window_width, window_step, pre_norm_gain, high_f_emph)
{
    return new Promise((resolve, reject)=>{
        if(N_mel_bins | N_fft_bins)
        {
            running.spec_bands = (spec_type==1) ?  N_mel_bins : N_fft_bins;
            
            running.frames_ack = 0;
            running.frames_analyzed = 0;
            running.PlayMode = 0;

            analyzer_config.spec_type = spec_type;
            analyzer_config.f_min = f_min;
            analyzer_config.f_max = f_max;
            analyzer_config.N_fft_bins = N_fft_bins;
            analyzer_config.N_mel_bins = N_mel_bins;
            analyzer_config.window_width = window_width;
            analyzer_config.window_step = window_step;
            analyzer_config.pre_norm_gain = pre_norm_gain;
            
            analyzer_config.high_f_emph = high_f_emph;


            //console.log('reset_nodes ' + String(running.spec_bands));
            resolve("ready");
        }
        else reject('Invalid reset_nodes config')
    });
}

export function reset_segmentor(process_level, spec_bands, plot_len=200, window_step=15, pause_length=200, min_segment_length=50, auto_noise_gate=true, voiced_max_dB=150, voiced_min_dB=50, callback=null, test_play=true, file_label=[]) 
{
    return new Promise((resolve, reject)=>{

        segmentor.reset_segmentation(process_level, spec_bands, plot_len, window_step, pause_length, min_segment_length, auto_noise_gate, voiced_max_dB, voiced_min_dB, callback, test_play, file_label).then(function(){
            resolve("ready");
            }).catch(function(err) {
                reject('reset_segmentor failed: ' + err);
        });
    });
}


export function reset_plot(plot_enable=false, canvas_element=null, width=800, height=400, spec_type=1, process_level=0, plot_len=100, bins_count=64, plot_lag=0)
{
    return new Promise((resolve, reject)=>{
        
        if(process_level)
        {
            if((plot_enable) && (canvas_element))
            {
                plot_config.plot_enable = true;
                plot_config.spec_type = spec_type;
                plot_config.process_level = process_level;  //different plotting methods for different levels, see animate() for more
                plot_config.plot_len = plot_len;
                plot_config.plot_lag = plot_lag;
                plot_config.last_seg_len = 0;
                
                plot_config.bins_y_labels = [];

                //if((plot_config.spec_type==2) || (plot_config.spec_type==3))
                //    plot_config.bins_count = N_fft_bins;
                //if(plot_config.spec_type==1)
                plot_config.bins_count = bins_count;

                if(plot_config.bins_count>32)
                    plot_config.axis_labels_sep = Math.round(plot_config.bins_count/32);    //spaces between the y major axis grid labels
                else
                    plot_config.axis_labels_sep = 0;
                plotter.init_canvas(canvas_element, width, height, plot_len, bins_count);
                plotter.clear_plot();
            }
            else
                plot_config.plot_enable = false;
            resolve("ready");
        }
        else reject('Invalid reset_plot config')
    });
}

export function online_play_the_mic()
{
    return new Promise((resolve, reject)=>{

        var FileAudioContext;
        var sourceNode;
        var workletNode;

        try
        {
            FileAudioContext = new AudioContext();
            sourceNode = null;
            //sourceNode = FileAudioContext.createMediaElementSource(source_obj);//FileAudioContext.createBufferSource();
            let constraints = {audio:true, video:false}

            navigator.mediaDevices.getUserMedia(constraints)
            .then((stream)=>{
                sourceNode = FileAudioContext.createMediaStreamSource(stream)
            //    resolve("sourced")
            //}).catch((err)=>{reject(err)})
            
            running.audioPlaying = 1;
            FileAudioContext.audioWorklet.addModule(AnalyzerWorklet_link).then(function() {
                workletNode = new AudioWorkletNode(FileAudioContext, 'spectrum-processor');
                workletNode.port.onmessage = (e) => {
                    
                    if(Number.isInteger(e.data) ) 
                    {
                        if(e.data==1)
                        {
                            running.frames_ack += e.data;
                            if ((running.frames_ack > running.frames_analyzed))
                            {
                                if(workletNode)
                                workletNode.port.postMessage(1);
                            }
                        }
                    }
                    
                    else if(e.data.bins_Hz)
                    {
                        plot_config.bins_y_labels = e.data.bins_Hz;
                        if((running.spec_bands<=0) || (running.spec_bands != plot_config.bins_y_labels.length))
                        {
                            //console.log("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                            reject("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                        }
                    }
                    else if (Uint32Array.prototype.isPrototypeOf(e.data))//(Array.isArray(e.data)) 
                    {
                        if(e.data.length > 0)
                        {
                            if((running.spec_bands<=0) || (running.spec_bands != e.data.length))
                            {
                                //console.log("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                                reject("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                            }
                            else
                            {
                                segmentor.spectrum_push(e.data, running.frames_analyzed);
                                if(plot_config.plot_enable)
                                    requestAnimFrame(animate);
                                running.frames_analyzed++;
                            }
                        }
                    }
                    
                    if(((running.audioPlaying==2) && (running.frames_analyzed>=running.frames_ack)) || (running.audioPlaying==-1))
                    {
                        if(running.audioPlaying==-1) console.log("Mic stream end by disconnect");
                        else console.log("Mic stream end normal (b)");

                        running.audioPlaying = 0;
                        if(workletNode)
                            workletNode.port.postMessage(22);   //send 22 to end the process

                        try{ sourceNode.stop(0); } catch(e){}
                        try{ sourceNode.disconnect(workletNode); } catch(e){}
                        //try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){} //mic mode
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                        if(FileAudioContext)
                            if(FileAudioContext.state != 'closed')
                                FileAudioContext.close();

                        sourceNode = null;
                        workletNode = null;
                        FileAudioContext = null;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                            requestAnimFrame(animate);
                        resolve('complete_d');
                    }
                    
                    //running.last_node_ms = Date.now();
                };
                workletNode.port.postMessage(analyzer_config);
                workletNode.port.postMessage(0);
                
                

                sourceNode.onended = function()
                {
                    console.log("Mic stream ended");
                    running.audioPlaying = 2;
                    
                    if(workletNode)
                        workletNode.port.postMessage(22);   //send 22 to end the process

                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    //try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){} //mic mode
                    
                    sourceNode = null;
                    //console.log("sourceNode End");

                    if((running.frames_analyzed >= running.frames_ack) && (running.audioPlaying!=0))
                    {
                        console.log("Mic stream end normal");
                        running.audioPlaying = 0;
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                        
                        if(FileAudioContext)
                            if(FileAudioContext.state != 'closed')
                                FileAudioContext.close();

                        workletNode = null;
                        FileAudioContext = null;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                            requestAnimFrame(animate);
                        resolve('complete');
                    }
                }
                
                try
                {
                    //sourceNode.buffer = audioData;
                    //sourceNode.connect(FileAudioContext.destination); //no need for mic mode
                    sourceNode.connect(workletNode);
                    workletNode.connect(FileAudioContext.destination);
                    
                    running.PlayMode = 3;   //1:online file play , 2:offline file play, 3:playing from mic
                    //sourceNode.start(0);
                    

                }
                catch (err)
                {
                    console.log('File loading failed: ' + err);
                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    //try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){} mic mode
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}

                    sourceNode = null;
                    workletNode = null;
                    FileAudioContext = null;
                    running.audioPlaying = 0;
                    
                    reject('Context connection failed: ' + err);
                }
                
            }).catch(function(err) {
                
                running.audioPlaying = 0;
                sourceNode = null;
                FileAudioContext = null;
                console.log('workletNode loading failed: ' + err);
                reject('workletNode loading failed: ' + err);
            });

            //resolve("mic sourced")
            }).catch((err)=>{reject(err)})

        }
        catch (e)
        {
            alert('Web Audio API is not supported in this browser');
            reject("Not supported");
        }

    });
    
}


export function online_play_the_sop(source_obj, offset=null, duration=null) //duration doesn't work
{
    return new Promise((resolve, reject)=>{

        var FileAudioContext;
        var sourceNode;
        var workletNode;

        try
        {
            FileAudioContext =  new (window.AudioContext || window.webkitAudioContext)();
            sourceNode = null;
            sourceNode = FileAudioContext.createMediaElementSource(source_obj);//FileAudioContext.createBufferSource();
            
            running.audioPlaying = 1;
            FileAudioContext.audioWorklet.addModule(AnalyzerWorklet_link).then(function() {
                workletNode = new AudioWorkletNode(FileAudioContext, 'spectrum-processor');
                workletNode.port.onmessage = (e) => {
                    
                    if(Number.isInteger(e.data) ) 
                    {
                        if(e.data==1)
                        {
                            running.frames_ack += e.data;
                            if ((running.frames_ack > running.frames_analyzed))
                            {
                                if(workletNode)
                                workletNode.port.postMessage(1);
                            }
                        }
                    }
                    
                    else if(e.data.bins_Hz)
                    {
                        plot_config.bins_y_labels = e.data.bins_Hz;
                        if((running.spec_bands<=0) || (running.spec_bands != plot_config.bins_y_labels.length))
                        {
                            //console.log("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                            reject("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                        }
                    }
                    else if (Uint32Array.prototype.isPrototypeOf(e.data))//(Array.isArray(e.data)) 
                    {
                        if(e.data.length > 0)
                        {
                            if((running.spec_bands<=0) || (running.spec_bands != e.data.length))
                            {
                                //console.log("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                                reject("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                            }
                            else
                            {
                                segmentor.spectrum_push(e.data, running.frames_analyzed);
                                if(plot_config.plot_enable)
                                    requestAnimFrame(animate);
                                running.frames_analyzed++;
                            }
                        }
                    }
                    
                    if(((running.audioPlaying==2) && (running.frames_analyzed>=running.frames_ack)) || (running.audioPlaying==-1))
                    {
                        if(running.audioPlaying==-1) console.log("Demo stream end by disconnect");
                        else console.log("Demo stream end normal (b)");

                        running.audioPlaying = 0;
                        if(workletNode)
                            workletNode.port.postMessage(22);   //send 22 to end the process

                        try{ sourceNode.stop(0); } catch(e){}
                        try{ sourceNode.disconnect(workletNode); } catch(e){}
                        try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                        if(FileAudioContext)
                            if(FileAudioContext.state != 'closed')
                                FileAudioContext.close();

                        sourceNode = null;
                        workletNode = null;
                        FileAudioContext = null;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                            requestAnimFrame(animate);
                        resolve('complete_d');
                    }
                    
                    running.last_node_ms = Date.now();
                };
                workletNode.port.postMessage(analyzer_config);
                workletNode.port.postMessage(0);
                
                

                sourceNode.onended = function()
                {
                    console.log("Demo stream ended");
                    running.audioPlaying = 2;
                    
                    if(workletNode)
                        workletNode.port.postMessage(22);   //send 22 to end the process

                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                    
                    sourceNode = null;
                    //console.log("sourceNode End");

                    if((running.frames_analyzed >= running.frames_ack) && (running.audioPlaying!=0))
                    {
                        console.log("Demo stream end normal");
                        running.audioPlaying = 0;
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                        
                        if(FileAudioContext)
                            if(FileAudioContext.state != 'closed')
                                FileAudioContext.close();

                        workletNode = null;
                        FileAudioContext = null;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                            requestAnimFrame(animate);
                        resolve('complete');
                    }
                }

                function Worklet_pinger()
                {
                    if((running.audioPlaying!=0) && (running.audioPlaying!=1) && ((Date.now() - running.last_node_ms) < 2000))
                    {
                        setTimeout(Worklet_pinger, 250);
                        try{ workletNode.port.postMessage(22); } catch(e){}
                    }
                    else if((running.audioPlaying==2) && (workletNode))
                    {
                        try{ workletNode.port.postMessage(22); } catch(e){}
                        
                        running.audioPlaying = 0;
                        running.last_node_ms = 0;
                        console.warn("Worklet is stuck. Terminating.");
                        sourceNode = null;
                        workletNode = null;
                        FileAudioContext = null;
                        resolve(2);
                    }
                    else if(running.audioPlaying==-1)
                    {
                        sourceNode = null;
                        workletNode = null;
                        FileAudioContext = null;
                        resolve(3);
                    }
                }
                window.setTimeout(Worklet_pinger, 100);
                
                try
                {
                    //sourceNode.buffer = audioData;
                    sourceNode.connect(FileAudioContext.destination);
                    sourceNode.connect(workletNode);
                    workletNode.connect(FileAudioContext.destination);
                    sourceNode.loop = false;
                    running.PlayMode = 1; //1:online file play , 2:offline file play, 3:playing from mic
                    //sourceNode.start(0);
                    //source_obj.play(0);
                    if(offset)
                    {
                        if(duration) source_obj.play(0, offset, duration);
                        else source_obj.play(0, offset);
                    }
                    else source_obj.play(0);    // when, offset, duration
                    

                }
                catch (err)
                {
                    console.log('Demo stream failed: ' + err);
                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}

                    sourceNode = null;
                    workletNode = null;
                    FileAudioContext = null;
                    running.audioPlaying = 0;
                    
                    reject('Demo stream loading failed: ' + err);
                }
                
            }).catch(function(err) {
                
                running.audioPlaying = 0;
                sourceNode = null;
                FileAudioContext = null;
                console.log('workletNode loading failed: ' + err);
                reject('workletNode loading failed: ' + err);
            });

        }
        catch (e)
        {
            alert('Web Audio API is not supported in this browser');
            reject("Not supported");
        }

    });
    
}

export function online_play_the_file_TryFFT(source_binary, offset=null, duration=null) //under construction - 2020-04-16
{
    return new Promise((resolve, reject)=>{

        var FileAudioContext;
        var sourceNode;
        var analyser;   //+

        try
        {
            FileAudioContext = new AudioContext();
            sourceNode = null;
            sourceNode = FileAudioContext.createBufferSource();
            analyser = FileAudioContext.createAnalyser();   //+

            /*
            Note that increasing fftSize does mean that the current time-domain data must be expanded to include past frames that it previously did not. This means that the AnalyserNode effectively MUST keep around the last 32768 sample-frames and the current time-domain data is the most recent fftSize sample-frames out of that.*/

            analyser.fftSize = 256; //this is the sample sample size, range 32 to 32768
            analyser.smoothingTimeConstant = 0.8;
            const bufferLength = analyser.frequencyBinCount; //readonly, N_FFT
            var dataArray = new Uint8Array(bufferLength);
            //https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
            //https://webaudio.github.io/web-audio-api/#dom-analysernode-getfloatfrequencydata

            plot_config.bins_y_labels = analyser.frequencyBinCount;
            running.spec_bands = analyser.frequencyBinCount;
            running.audioPlaying = 1;
        
            workletNode = new AudioWorkletNode(FileAudioContext, 'spectrum-processor');
            
            workletNode.port.onmessage = (e) => {
                
                if(Number.isInteger(e.data) ) 
                {
                    if(e.data==1)
                    {
                        running.frames_ack += e.data;
                        if ((running.frames_ack > running.frames_analyzed))
                        {
                            if(workletNode)
                            workletNode.port.postMessage(1);
                        }
                    }
                }
                
                else if(e.data.bins_Hz)
                {
                    plot_config.bins_y_labels = e.data.bins_Hz;
                    if((running.spec_bands<=0) || (running.spec_bands != plot_config.bins_y_labels.length))
                    {
                        //console.log("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                        reject("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                    }
                }
                else if (Uint32Array.prototype.isPrototypeOf(e.data))//(Array.isArray(e.data)) 
                {
                    if(e.data.length > 0)
                    {
                        if((running.spec_bands<=0) || (running.spec_bands != e.data.length))
                        {
                            //console.log("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                            reject("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                        }
                        else
                        {
                            segmentor.spectrum_push(e.data, running.frames_analyzed);
                            if(plot_config.plot_enable)
                                requestAnimFrame(animate);
                            running.frames_analyzed++;
                        }
                    }
                }
                
                if(((running.audioPlaying==2) && (running.frames_analyzed>=running.frames_ack)) || (running.audioPlaying==-1))
                {
                    if(running.audioPlaying==-1) console.log("Online file end by disconnect");
                    else console.log("Online file end normal (b)");

                    running.audioPlaying = 0;
                    if(workletNode)
                        workletNode.port.postMessage(22);   //send 22 to end the process

                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                    if(FileAudioContext)
                        if(FileAudioContext.state != 'closed')
                            FileAudioContext.close();

                    sourceNode = null;
                    workletNode = null;
                    FileAudioContext = null;
                    segmentor.segment_truncate();
                    if(plot_config.plot_enable)
                    {
                        requestAnimFrame(animate);
                        setTimeout(animate, 100);
                    }
                    resolve('complete_d');
                }
                
                //running.last_node_ms = Date.now();
            };
            workletNode.port.postMessage(analyzer_config);
            workletNode.port.postMessage(0);
            
            

            sourceNode.onended = function()
            {
                running.audioPlaying = 2;
                
                if(workletNode)
                    workletNode.port.postMessage(22);   //send 22 to end the process

                try{ sourceNode.stop(0); } catch(e){}
                try{ sourceNode.disconnect(workletNode); } catch(e){}
                try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}

                
                sourceNode = null;

                //console.log("sourceNode End");
                
                if((running.frames_analyzed >= running.frames_ack) && (running.audioPlaying!=0))
                {
                    console.log("Online file end normal");
                    running.audioPlaying = 0;
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                    
                    if(FileAudioContext)
                        if(FileAudioContext.state != 'closed')
                            FileAudioContext.close();

                    workletNode = null;
                    FileAudioContext = null;
                    segmentor.segment_truncate();
                    if(plot_config.plot_enable)
                        requestAnimFrame(animate);
                    resolve('complete');
                }
            }
            
            try
            {
                FileAudioContext.decodeAudioData(source_binary, function (buffer)
                {
                    sourceNode.buffer = buffer;
                    sourceNode.connect(FileAudioContext.destination);
                    sourceNode.connect(workletNode);
                    workletNode.connect(FileAudioContext.destination);
                    sourceNode.loop = false;
                    running.PlayMode = 1; //1:online file play , 2:offline file play, 3:playing from mic
                    //sourceNode.stop(1); //error
                    
                    if((offset) || (duration))
                    {
                        offset -= 0.5; if(offset<0) offset=0;
                        if(duration) sourceNode.start(0, offset, duration);
                        else sourceNode.start(0, offset);
                    }
                    else sourceNode.start(0);    // when, offset, duration
                    
                    //console.log(sourceNode.)

                }, function(e){  onError(e);  reject('Audio decode error: ' + e); });

            }
            catch (err)
            {
                console.log('File loading failed: ' + err);
                try{ sourceNode.stop(0); } catch(e){}
                try{ sourceNode.disconnect(workletNode); } catch(e){}
                try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}

                sourceNode = null;
                workletNode = null;
                FileAudioContext = null;
                running.audioPlaying = 0;
                
                reject('File loading failed: ' + err);
            }

        }
        catch (e)
        {
            alert('Web Audio API is not supported in this browser');
            reject("Not supported");
        }

    });
    
}


export function online_play_the_file(source_binary, offset=null, duration=null)
{
    return new Promise((resolve, reject)=>{

        var FileAudioContext;
        var sourceNode;
        var workletNode;

        try
        {
            FileAudioContext = new AudioContext();
            sourceNode = null;
            sourceNode = FileAudioContext.createBufferSource();

            running.audioPlaying = 1;
            FileAudioContext.audioWorklet.addModule(AnalyzerWorklet_link).then(function() {
                workletNode = new AudioWorkletNode(FileAudioContext, 'spectrum-processor');
                
                workletNode.port.onmessage = (e) => {
                    
                    if(Number.isInteger(e.data) ) 
                    {
                        if(e.data==1)
                        {
                            running.frames_ack += e.data;
                            if ((running.frames_ack > running.frames_analyzed))
                            {
                                if(workletNode)
                                workletNode.port.postMessage(1);
                            }
                        }
                    }
                    
                    else if(e.data.bins_Hz)
                    {
                        plot_config.bins_y_labels = e.data.bins_Hz;
                        if((running.spec_bands<=0) || (running.spec_bands != plot_config.bins_y_labels.length))
                        {
                            //console.log("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                            reject("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                        }
                    }
                    else if (Uint32Array.prototype.isPrototypeOf(e.data))//(Array.isArray(e.data)) 
                    {
                        if(e.data.length > 0)
                        {
                            if((running.spec_bands<=0) || (running.spec_bands != e.data.length))
                            {
                                //console.log("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                                reject("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                            }
                            else
                            {
                                segmentor.spectrum_push(e.data, running.frames_analyzed);
                                if(plot_config.plot_enable)
                                    requestAnimFrame(animate);
                                running.frames_analyzed++;
                            }
                        }
                    }
                    
                    if(((running.audioPlaying==2) && (running.frames_analyzed>=running.frames_ack)) || (running.audioPlaying==-1))
                    {
                        if(running.audioPlaying==-1) console.log("Online file end by disconnect");
                        else console.log("Online file end normal (b)");

                        running.audioPlaying = 0;
                        if(workletNode)
                            workletNode.port.postMessage(22);   //send 22 to end the process

                        try{ sourceNode.stop(0); } catch(e){}
                        try{ sourceNode.disconnect(workletNode); } catch(e){}
                        try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                        if(FileAudioContext)
                            if(FileAudioContext.state != 'closed')
                                FileAudioContext.close();

                        sourceNode = null;
                        workletNode = null;
                        FileAudioContext = null;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                        {
                            requestAnimFrame(animate);
                            setTimeout(animate, 100);
                        }
                        resolve('complete_d');
                    }
                    
                    //running.last_node_ms = Date.now();
                };
                workletNode.port.postMessage(analyzer_config);
                workletNode.port.postMessage(0);
                
                

                sourceNode.onended = function()
                {
                    running.audioPlaying = 2;
                    
                    if(workletNode)
                        workletNode.port.postMessage(22);   //send 22 to end the process

                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}

                    
                    sourceNode = null;

                    //console.log("sourceNode End");
                    
                    if((running.frames_analyzed >= running.frames_ack) && (running.audioPlaying!=0))
                    {
                        console.log("Online file end normal");
                        running.audioPlaying = 0;
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                        
                        if(FileAudioContext)
                            if(FileAudioContext.state != 'closed')
                                FileAudioContext.close();

                        workletNode = null;
                        FileAudioContext = null;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                            requestAnimFrame(animate);
                        resolve('complete');
                    }
                }
                
                try
                {
                    FileAudioContext.decodeAudioData(source_binary, function (buffer)
                    {
                        sourceNode.buffer = buffer;
                        sourceNode.connect(FileAudioContext.destination);
                        sourceNode.connect(workletNode);
                        workletNode.connect(FileAudioContext.destination);
                        sourceNode.loop = false;
                        running.PlayMode = 1; //1:online file play , 2:offline file play, 3:playing from mic
                        //sourceNode.stop(1); //error
                        
                        if((offset) || (duration))
                        {
                            offset -= 0.5; if(offset<0) offset=0;
                            if(duration) sourceNode.start(0, offset, duration);
                            else sourceNode.start(0, offset);
                        }
                        else sourceNode.start(0);    // when, offset, duration
                        
                        //console.log(sourceNode.)

                    }, function(e){  onError(e);  reject('Audio decode error: ' + e); });

                }
                catch (err)
                {
                    console.log('File loading failed: ' + err);
                    try{ sourceNode.stop(0); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){}
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}

                    sourceNode = null;
                    workletNode = null;
                    FileAudioContext = null;
                    running.audioPlaying = 0;
                    
                    reject('File loading failed: ' + err);
                }
                
            }).catch(function(err) {
                
                running.audioPlaying = 0;
                sourceNode = null;
                FileAudioContext = null;
                console.log('workletNode loading failed: ' + err);
                reject('workletNode loading failed: ' + err);
            });

        }
        catch (e)
        {
            alert('Web Audio API is not supported in this browser');
            reject("Not supported");
        }

    });
    
}


export function Garbage_Collect()
{
    //these objects are memory heavy
    try { FileAudioContext = null; FileAudioContext = undefined; } catch (e) { }
    try { sourceNode = null; sourceNode = undefined; } catch (e) { }
    try { workletNode = null; workletNode = undefined; } catch (e) { }
    // console.log("GC");
}

export function offline_play_the_file(source_binary, offset=null, duration=null)
{

    return new Promise((resolve, reject)=>{

        var FileAudioContext;
        var sourceNode;
        var workletNode;
        
        try
        {
            FileAudioContext = new OfflineAudioContext(1,48000*1000,48000);
            sourceNode = null;
            sourceNode = FileAudioContext.createBufferSource();


            running.audioPlaying = 1;
            
            FileAudioContext.audioWorklet.addModule(AnalyzerWorklet_link).then(function() {
                workletNode = new AudioWorkletNode(FileAudioContext, 'spectrum-processor');
                workletNode.port.onmessage = (e) => {
                    
                    if(Number.isInteger(e.data) ) 
                    {
                        if(e.data==1)
                        {
                            running.frames_ack++;
                            if ((running.frames_ack > running.frames_analyzed))
                            {
                                if(workletNode)
                                workletNode.port.postMessage(1);
                            }
                        }
                    }
                    else if(e.data.bins_Hz)
                    {
                        plot_config.bins_y_labels = e.data.bins_Hz;
                        if((running.spec_bands<=0) || (running.spec_bands != plot_config.bins_y_labels.length))
                        {
                            //console.log("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                            reject("Bins Init mismatch: "+ String(running.spec_bands) + ", " + String(plot_config.bins_y_labels.length));
                        }
                    }
                    else if (Uint32Array.prototype.isPrototypeOf(e.data))//(Array.isArray(e.data)) Float32Array.prototype.isPrototypeOf(e.data)
                    {
                        if(e.data.length > 0)
                        {
                            if((running.spec_bands<=0) || (running.spec_bands != e.data.length))
                            {
                                //console.log("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                                reject("Bins count mismatch: "+ String(running.spec_bands) + ", " + String(e.data.length));
                            }
                            else
                            {
                                segmentor.spectrum_push(e.data, running.frames_analyzed);
                                if(plot_config.plot_enable)
                                    requestAnimFrame(animate);
                                    
                                running.frames_analyzed++;
                            }
                        }
                    }
                    
                    if(((running.audioPlaying==2) && (running.frames_analyzed>=running.frames_ack))  || (running.audioPlaying==-1))
                    {
                        
                        running.frames_ack = 0;

                        if(workletNode)
                            workletNode.port.postMessage(22);   //send 22 to end the process

                        try{ sourceNode.stop(0); } catch(e){}
                        try{ sourceNode.disconnect(workletNode); } catch(e){}
                        //try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){} //offline mode
                        try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}

                        sourceNode = null;
                        workletNode = null;
                        FileAudioContext = null;
                        if(running.audioPlaying==-1) console.log("Offline file end by disconnect");
                        //else console.log("Offline file end normal (b)");
                        running.audioPlaying = 0;
                        segmentor.segment_truncate();
                        if(plot_config.plot_enable)
                            requestAnimFrame(animate);
                        
                        
                        resolve('complete_u');
                    }
                    
                    running.last_node_ms = Date.now();
                };
                workletNode.port.postMessage(analyzer_config);
                workletNode.port.postMessage(0);
                
                
                
                try
                {
                    FileAudioContext.decodeAudioData(source_binary, function (buffer)
                    {
                        sourceNode.buffer = buffer;
                        //sourceNode.connect(FileAudioContext.destination); //no need for offline mode
                        sourceNode.connect(workletNode);
                        workletNode.connect(FileAudioContext.destination);
                        sourceNode.loop = false;
                        running.PlayMode = 2; //1:online file play , 2:offline file play, 3:playing from mic
                        if(offset)
                        {
                            if(duration) sourceNode.start(0, offset, duration);
                            else sourceNode.start(0, offset);
                        }
                        else sourceNode.start(0);    // Play the sound now, second paramter is start (in seconds), third is duration to play

                        FileAudioContext.startRendering().then(function(renderedBuffer) {

                            
                            let finish_time =  Date.now();
                            function Worklet_pinger()
                            {
                                
                                if((running.audioPlaying==2) && ((Date.now() - finish_time) < 10000))
                                {
                                    console.log('Rendering finished.');
                                    setTimeout(Worklet_pinger, 100);
                                    try{ workletNode.port.postMessage(22); } catch(e){}
                                }
                                else if((running.audioPlaying==2) && (workletNode))
                                {
                                    console.error("Worklet is stuck. Terminating.");

                                    running.audioPlaying = -1;
                                    running.last_node_ms = 0;
                                    try{ workletNode.port.postMessage(22); } catch(e){}
                                    resolve(3);
                                }
                                else if(running.audioPlaying==-1) 
                                {
                                    setTimeout(Worklet_pinger, 250);
                                    try{ workletNode.port.postMessage(22); } catch(e){}
                                }
                                else if(running.audioPlaying==1)
                                {
                                    //probably next file started playing, so quit this thread
                                }
                                else if((running.audioPlaying==0) || ((Date.now() - running.last_node_ms) > 10000))  //won't happen
                                {
                                    workletNode = null;
                                    running.audioPlaying = 0;
                                    resolve(3); //probably already resolved
                                }
                                else
                                {
                                    setTimeout(Worklet_pinger, 250);
                                    try{ workletNode.port.postMessage(22); } catch(e){}
                                }
                            }
                            
                           
                
                            workletNode.port.postMessage(22);   //send 22 to end the process
                            //set running.audioPlaying = 2; to flag ending
                            window.setTimeout(function() {
                                running.audioPlaying = 2;
                                if(workletNode)
                                workletNode.port.postMessage(22);   //send 22 to end the process

                                window.setTimeout(Worklet_pinger, 100); //set running.audioPlaying = 2; to flag ending
                                
                            }, 100);
                            
                            renderedBuffer = null;
                            sourceNode = null;
                        
                        }).catch(function(err) {
                            running.audioPlaying = 0;
                            console.log('Rendering failed: ' + err);
                            reject('Rendering failed: ' + err);
                            // Note: The promise should reject when startRendering is called a second time on an OfflineAudioContext
                        });

                    }, function(e){  onError(e);  reject('Audio decode error: ' + e); });

                }
                catch (err)
                {
                    console.log('File loading failed: ' + err);
                    try{ sourceNode.stop(0); } catch(e){}
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}
                    try{ sourceNode.disconnect(workletNode); } catch(e){}
                    //try{ sourceNode.disconnect(FileAudioContext.destination); } catch(e){} //offline mode
                    try{ workletNode.disconnect(FileAudioContext.destination); } catch(e){}

                    sourceNode = null;
                    workletNode = null;
                    FileAudioContext = null;
                    running.audioPlaying = 0;
                    
                    reject('File loading failed: ' + err);
                }
                
            }).catch(function(err) {
                
                running.audioPlaying = 0;
                sourceNode = null;
                FileAudioContext = null;
                console.log('workletNode loading failed: ' + err);
                reject('workletNode loading failed: ' + err);
            });

        }
        catch (e)
        {
            alert('Web Audio API is not supported in this browser. Error: ' + e);
            reject("Web Audio API error: " + e);
        }

    });
    
}




export function disconnect_nodes(reason)
{
    if(running.audioPlaying!=0)
    {
        running.audioPlaying = -1;
        
        console.log("Disconnect Nodes because: " + reason)
    }
}


export function isNodePlaying()
{
    if(running.audioPlaying>0) return true;
    else return false
}





let plot_lagger = 0;
let anim_busy = false;
let plot_labels_change = false;

export function set_predicted_label_for_segment(seg_index, label_index, predicted_label)
{
    
    segmentor.set_segments_label(seg_index, label_index, predicted_label);
    plot_labels_change = true;
    setTimeout(animate, 100);
}


async function animate() 
{
    anim_busy = true;
    let max_val = segmentor.get_context_maximum()   //this is used to normalize the brightness
    
    if((plot_config.process_level==1) || (plot_config.process_level==2))
    {
        plot_lagger++;
        if(plot_lagger < plot_config.plot_lag){ anim_busy = false; return true; }
        plot_lagger = 0;

        let spec = segmentor.get_spectrum();
       
        if(spec.length > 0)
        {
            if(plot_config.process_level==2)
            {
                plotter.clear_plot(false);  //disable clearing because this spectrum uses timeout to avoid jitter
                plotter.plot_spectrum(spec, max_val, plot_config.bins_y_labels);
                plotter.plot_axis_majors(plot_config.bins_y_labels, plot_config.axis_labels_sep)
            }
            else
            {
                plotter.clear_plot(true);
                plotter.plotBands(spec[spec.length-1], max_val, plot_config.bins_y_labels, plot_config.axis_labels_sep);
            }
        }
        spec = null;
    }
    else if ((plot_config.process_level==3) || (plot_config.process_level>=4))  //segments or formants
    {
        let sum_ci = 0;
        let seg_count_now = segmentor.get_segments_count(plot_config.process_level);
        
        
        if((seg_count_now > 0) && ((plot_config.last_seg_len != seg_count_now) || (plot_labels_change)))       //check if new segment is added by segmentor module
        {
            plot_labels_change = false;
            plot_config.last_seg_len = seg_count_now;
            
            
            plotter.clear_plot();
            for(let si=seg_count_now-1; si>=0; si--)
            {
                let seg_size = segmentor.get_segments_ci(si)[1];    //get the starting frame index and total frame counts
                
                if(seg_size > 0)
                {
                    let seg_data = segmentor.get_segment(si, plot_config.process_level);
                    let seg_t0_tlen = segmentor.get_seg_timestamps(si); //start time and duration relative to reset
                    
                    
                    sum_ci = sum_ci + seg_size + 2;
                    let left_indent = plot_config.plot_len - sum_ci;
                    //console.log(seg_size);
                    if(plot_config.process_level>=4)
                    {
                        plotter.plot_formants(seg_data, seg_size, seg_t0_tlen, left_indent, max_val);
                        if((plot_config.process_level==10) || (plot_config.process_level==11)  || (plot_config.process_level==13))
                        {
                            plotter.plot_syllable_anchors(si, segmentor.get_syllables_ci(si), left_indent)
                        }
                        else if((plot_config.process_level==12))
                        {
                            plotter.plot_syllable_anchors(si, segmentor.get_syllables_ci(si), left_indent, segmentor.get_syllables_curves(si))
                        }
                        
                    }
                    else if(plot_config.process_level==3)
                    plotter.plot_raw_segment(seg_data, seg_size, seg_t0_tlen, left_indent, max_val);
                    
                    
                    seg_data = null;
                    let segment_label = segmentor.get_segments_label(si);
                    //console.log(si + '\t' + String(segment_label));
                    plotter.plot_segment_labels(seg_size, left_indent, segment_label);
                    if(sum_ci>plot_config.plot_len) break;
                }
                else
                {
                    //if there is a segment of size zero, there is a problem in segmentation
                    console.warn("Segment size error, si:" + (si) + ", size:" + (seg_size));
                }
            }
            plotter.plot_axis_majors(plot_config.bins_y_labels, plot_config.axis_labels_sep)
        }
    }
    else
        console.log("Error: Invalid process_level");
    anim_busy = false;
    return true;
}




// To deal with different animation function names in different browsers/*
window.requestAnimFrame_2 = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            function(callback, element){
                window.setTimeout(callback, 100);
            };
    })();

window.requestAnimFrame = (function(){
    return   function(callback){
                if(!anim_busy) { window.setTimeout(callback, 10); anim_busy=true;}
            };
    })();

function createMicSrcFrom(audioCtx) //basic code for sourcing mic
{
    sourceNode = null;
    return new Promise((resolve, reject)=>{
        let constraints = {audio:true, video:false}

        navigator.mediaDevices.getUserMedia(constraints)
        .then((stream)=>{
            sourceNode = audioCtx.createMediaStreamSource(stream)
            resolve("sourced")
        }).catch((err)=>{reject(err)})
    })
}


function onError(e)
{
    console.log(e);
    running.audioPlaying = 0;
    document.getElementById('msg').textContent = "Error";
    Garbage_Collect();
}



