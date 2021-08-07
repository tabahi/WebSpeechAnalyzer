

const AudioNodes = require('./AudioNodes.js'); 

let set = { plot_enable:false, spec_type: 1, output_level: 4, plot_len: 200, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pause_length:200, min_seg_length:50, auto_noise_gate: true, voiced_max_dB:100, voiced_min_dB:10,plot_lag:1, pre_norm_gain: 1000, high_f_emph:0.0, plot_canvas:null, canvas_width:200, canvas_height:100 };

export function configure(cfg)
{
    if(cfg.spec_type !== null) set.spec_type = cfg.spec_type;
    if(cfg.output_level) set.output_level = cfg.output_level;
    if(cfg.f_min !== null) set.f_min = cfg.f_min;
    if(cfg.f_max) set.f_max = cfg.f_max;
    if(cfg.N_fft_bins) set.N_fft_bins = cfg.N_fft_bins;
    if(cfg.N_mel_bins) set.N_mel_bins = cfg.N_mel_bins;
    if(cfg.window_width) set.window_width = cfg.window_width;
    if(cfg.window_step) set.window_step = cfg.window_step;
    if(cfg.pre_norm_gain) set.pre_norm_gain = cfg.pre_norm_gain;
    if(cfg.high_f_emph !== null) set.high_f_emph = cfg.high_f_emph;
    if(cfg.pause_length) set.pause_length = cfg.pause_length;
    if(cfg.min_seg_length) set.min_seg_length = cfg.min_seg_length;
    
    if(cfg.auto_noise_gate !== null) set.auto_noise_gate = cfg.auto_noise_gate;
    if(cfg.voiced_max_dB) set.voiced_max_dB = cfg.voiced_max_dB;
    if(cfg.voiced_min_dB !== null) set.voiced_min_dB = cfg.voiced_min_dB;

    if((cfg.plot_enable) && (cfg.plot_canvas))
    {
        set.plot_enable = cfg.plot_enable;
        set.plot_canvas = cfg.plot_canvas;
        if(cfg.plot_len) set.plot_len = cfg.plot_len;
        if(cfg.plot_lag) set.plot_lag = cfg.plot_lag;
        if(cfg.canvas_width) set.canvas_width = cfg.canvas_width;
        if(cfg.canvas_height) set.canvas_height = cfg.canvas_height;
        let bin_count = (set.spec_type==1)?set.N_mel_bins:set.N_fft_bins;
        AudioNodes.reset_plot(set.plot_enable, set.plot_canvas, set.canvas_width, set.canvas_height, set.spec_type, set.output_level, set.plot_len, bin_count, set.plot_lag);
    }
    else
    {
        set.plot_enable = false;
    }
}


export function LaunchAudioNodes(context_source, source_obj=null, callback_after_segment=null, label=[], offline_mode=false, test_play=true, play_offset=null, play_duration=null)
{
    /*
    'context_source' (int):
    1 --- Play from a loaded file - online (on speakers)
    1 --- Play from a loaded file - offline (silently in the background)
    2 --- Play from an Audio element (pass audio object as source_obj)
    3 --- Stream from mic
    
    'source_obj' (object):
    Source audio object.
    If context_source=1 (playing from a local file) then pass a binary of audio.
    If context_source=2 (playing from a web address) then pass Audio object.
    If context_source=3 (playing from mic Pass null). Different audio contexts are buffered/streamed differently, therefore each has a separate function in AudioNodes.js

    'callback_after_segment':
    It is the callback function to be called after each segment ends. It should pass 3 parameters; 'segment_index', 'segment_labels_array', 'segment_features_array'. Callback is called asynchronously, so there might be a latency between audio play and it's respective callback, that's why it's important to send the labels to async segmentor function.
    
    'label' (Array):
    It is an array of labels for currently playing file. It is returned as it is to the callback function.
    It is used to avoid the label mismatch during slow async processing in case if a new file is playing, but the callback sends the output of the previous one.
    Sometimes callback is called with a delay of 2 seconds, so it helps to keep track which file was playing 2 seconds ago.

    'offline_mode' (boolean):
    If true then the locally loaded files will be played silently in an offline buffer.


    'test_play' (boolean)
    set it true to avoid calling the callback. Plots and AudioNodes will still work as it is, but there will be no call backs. It can be enabled to test plotting or re listening.
    
    'play_offset' and 'play_duration' are in seconds to play a certain part of the file, otherwise pass null.
    
    Returns: This function returns a promise as resolve(true) after playback is finished or reject(err) if there is an error.
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
                 
                /* 2 - Reset segmentor, Segment/formants/phoneme analyzer settings*/
                let N_bin_segmentor = (set.spec_type==1) ?  set.N_mel_bins : set.N_fft_bins;
                AudioNodes.reset_segmentor(set.output_level, N_bin_segmentor, set.plot_len, set.window_step, set.pause_length, set.min_seg_length, set.auto_noise_gate, set.voiced_max_dB, set.voiced_min_dB, callback_after_segment, test_play, label).then(function()
                {
                    /* 3 - Reset plot, skip this if not needed */
                    let bin_count = (set.spec_type==1)?set.N_mel_bins:set.N_fft_bins;
                    AudioNodes.reset_plot(set.plot_enable, set.plot_canvas, set.canvas_width, set.canvas_height, set.spec_type, set.output_level, set.plot_len, bin_count, set.plot_lag).then(function()
                    {
                        /* Launch a specified Audio Node. Different audio sources are launched by different function*/
                        //let t0 = performance.now();
                        if((context_source==1) && (source_obj))
                        {
                            
                            if(offline_mode)
                            {
                                AudioNodes.Garbage_Collect();
                                AudioNodes.offline_play_the_file(source_obj, play_offset, play_duration).then(function() {
                                    
                                    resolve(true);
                                    //console.log((performance.now() - t0) + " ms.");

                                }).catch((err)=>{
                                    console.error(err);
                                    reject(err);
                                })
                            }
                            else
                            {
                                AudioNodes.online_play_the_file(source_obj, play_offset, play_duration).then(function() {
                                    resolve(true);
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
                                resolve(true);
                                //console.log((performance.now() - t0) + " ms.");

                            }).catch((err)=>{
                                console.error(err);
                                reject(err);
                            })
                        }
                        else if (context_source==3)
                        {
                            AudioNodes.online_play_the_mic().then(function() {
                                resolve(true);
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

