

const AudioNodes = require('./AudioNodes.js'); 

let set = { plot_enable:false, spec_type: 1, process_level: 4, plot_len: 200, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pause_length:250, min_seg_length:250, plot_lag:1, pre_norm_gain: 1000, high_f_emph:0.0, plot_canvas:null, canvas_width:200, canvas_height:100 };

export function configure(spec_type=1, process_level=4, f_min=50, f_max=4000, N_fft_bins=256, N_mel_bins=128, window_width=25, window_step=25, pre_norm_gain=1000, high_f_emph=0.0, pause_length=250, min_seg_length=250, plot_enable=false, plot_len=100, plot_lag=0, plot_canvas=null, canvas_width=null, canvas_height=null)
{
    set.spec_type = spec_type;          //1=Mel, 2=FFT power, 3=FFT 
    set.process_level = process_level;  //1=Bins, 2=Spectrum, 3=Segmentation, 4=Formant Extraction, 5=Phoneme Extraction
    set.f_min = f_min;
    set.f_max = f_max;
    set.N_fft_bins = N_fft_bins;
    set.N_mel_bins = N_mel_bins;
    set.window_width = window_width;
    set.window_step = window_step;
    set.pre_norm_gain = pre_norm_gain;
    set.high_f_emph = high_f_emph;
    set.pause_length = pause_length;
    set.min_seg_length = min_seg_length;

    if(plot_enable)
    {
        set.plot_enable = plot_enable;
        set.plot_len = plot_len;
        set.plot_lag = plot_lag;
        set.plot_canvas = plot_canvas;
        set.canvas_width = canvas_width;
        set.canvas_height = canvas_height;
        let bin_count = (set.spec_type==1)?set.N_mel_bins:set.N_fft_bins;
        AudioNodes.reset_plot(set.plot_enable, set.plot_canvas, set.canvas_width, set.canvas_height, set.spec_type, set.process_level, set.plot_len, bin_count, set.plot_lag);
    }
    else
    {
        set.plot_enable = false;
    }
}


export function LaunchAudioNodes(source_obj=null, callback_after_segment=null, label=[], offline_mode=false, context_source=1, test_play=true, play_offset=null, play_duration=null)
{
    /*'source_obj':
    Source audio object. If playing from a local file (context_source=1) then pass a binary of audio. If playing from a web address (context_source=2) then pass Audio object. Pass null if playing from mic (context_source=3). Different audio contexts are buffered/streamed differently, therefore each has a separate function in AudioNodes.js

    'callback_after_segment':
    It is the callback function to be called after each segment ends. It should pass 3 parameters; 'segment_index', 'segment_labels_array', 'segment_features_array'. Callback is called asynchronously, so there might be a latency between audio play and it's respective callback, that's why it's important to send the labels to async segmentor function.
    
    'label':
    It is an array of labels for currently playing file. It is returned as it is to the callback function.
    It is used to avoid the label mismatch during slow async processing in case if a new file is playing, but the callback sends the output of the previous one.
    Sometimes callback is called with a delay of 2 seconds, so it helps to keep track which file was playing 2 seconds ago.

    'offline_mode': If true then the locally loaded files will be played silently in an offline buffer.

    'context_source':
    1 --- Play from a loaded file - online (on speakers)
    1 --- Play from a loaded file - offline (silently in the background)
    2 --- Play from an Audio element (pass audio object as source_obj)
    3 --- Stream from mic

    'test_play'
    set it true to avoid calling the callback. Plots and AudioNodes will still work as it is, but there will be no call backs. It can be enabled to test plotting or re listening.
    
    'play_offset' and 'play_duration' are in seconds to play a certain part of the file, otherwise pass null.
    
    Returns: This function returns a promise as resolve("Done") after playback is finished or reject(err) if there is an error.
    If you want an abrupt stop, then call the stop_playing("no reason") function. Then this function will return resolve("no reason").
    */
   
    return new Promise((resolve, reject)=>{
        
        if(AudioNodes.isNodePlaying())
        {
            reject("Error: Already playing");
        }
        else
        {
            /* 1 - Reset audio nodes, Input and sampling settings */
            AudioNodes.reset_nodes(set.spec_type, set.f_min, set.f_max, set.N_fft_bins, set.N_mel_bins, set.window_width, set.window_step, set.pre_norm_gain, set.high_f_emph).then(function()
            {
                 /* 2 - Reset plot, skip this if not needed */
                let bin_count = (set.spec_type==1)?set.N_mel_bins:set.N_fft_bins;
                AudioNodes.reset_plot(set.plot_enable, set.plot_canvas, set.canvas_width, set.canvas_height, set.spec_type, set.process_level, set.plot_len, bin_count, set.plot_lag).then(function()
                {
                    /* 3 - Reset segmentor, Segment/formants/phoneme analyzer settings*/
                    let N_bin_segmentor = (set.spec_type==1) ?  set.N_mel_bins : set.N_fft_bins;
                    AudioNodes.reset_segmentor(set.process_level, N_bin_segmentor, set.plot_len, set.window_step, set.pause_length, set.min_seg_length, callback_after_segment, test_play, label).then(function()
                    {
                        /* Launch a specified Audio Node. Different audio sources are launched by different function*/
                        //let t0 = performance.now();
                        if((context_source==1) && (source_obj))
                        {
                            
                            if(offline_mode)
                            {
                                AudioNodes.Garbage_Collect();
                                AudioNodes.offline_play_the_file(source_obj, play_offset, play_duration).then(function() {
                                    
                                    resolve("Done");
                                    //console.log((performance.now() - t0) + " ms.");

                                }).catch((err)=>{
                                    console.error(err);
                                    reject(err);
                                })
                            }
                            else
                            {
                                AudioNodes.online_play_the_file(source_obj, play_offset, play_duration).then(function() {
                                    resolve("Done");
                                    //console.log((performance.now() - t0) + " ms.");

                                }).catch((err)=>{
                                    console.error(err);
                                    reject(err);
                                })
                            }
                        }
                        else if((context_source==2) && (source_obj))
                        {
                            AudioNodes.online_play_the_sop(source_obj, play_offset, play_duration).then(function() {
                                resolve("Done");
                                //console.log((performance.now() - t0) + " ms.");

                            }).catch((err)=>{
                                console.error(err);
                                reject(err);
                            })
                        }
                        else if (context_source==3)
                        {
                            AudioNodes.online_play_the_mic().then(function() {
                                resolve("Done");
                                //console.log((performance.now() - t0) + " ms.");

                            }).catch((err)=>{
                                console.error(err);
                                reject(err);
                            })
                        }
                        else
                        {
                            reject("Invalid audio source");
                        }
                        
                    }).catch((err)=>{
                        console.error(err);
                        reject(err);
                    })
                }).catch((err)=>{
                    console.error(err);
                    reject(err);
                })
            }).catch((err)=>{
                console.error(err);
                reject(err);
            })
        }

    });
}



export function StopAudioNodes(reason="no reason")
{
    AudioNodes.disconnect_nodes(reason);
}

export function set_predicted_label_for_segment(seg_index, label_index, predicted_label)
{
    AudioNodes.set_predicted_label_for_segment(seg_index, label_index, predicted_label);
}
