// function spectrum_push() is called from AudioNodes.js

//var SILENT_SEG_BRAKIER = 12;
//const PAUSE_LENGTH = 300;   //in milliseconds. Speech segment is truncated when a pause is detected of this durations
const fm_mod = require('./formants.js');
//const syls_mod = require('./syllables.js');
const utt_mod = require('./uttfeatures.js');
const stats = require('./stats.js');

var s_set = {spec_bands: -1, plot_len:200, max_voiced_bin:80, window_step:0.025, current_frame: 0, play_end:false, no_fm_segs:0, c_ci:0, c_started:-1, current_label: [], callbacks_processed:0, seg_limit_1:200, seg_limit_2:250, seg_min_frames:20, seg_breaker:12, process_level:5, auto_noise_gate: true, voiced_max_dB:100, voiced_min_dB:10, call_at_end:false};

var spec_hist = []; //mel spec raw
var segments_raw = [];  //array to hold 'fm'
var segments_fm = [];
var segments_ci = [];
var segments_labels = [];

var formants_ft = [];
var syllables = [];
var syllables_ft = [];


var temp_spec_hist = [];
var bins_in_process = false;

var context_maximum = 50;
var local_minimum = 2;
let last_real_high = context_maximum;
let last_real_low = local_minimum;
var max_history_len = 0;
var old_maxes_sum = 0;
var old_maxes_n = 0;

var callback_func; //callback_after_elements_extraction
let test_mode = true;
const break_at_limits = false;

export async function reset_segmentation(process_level, spec_bands, plot_len=200, window_step=15, pause_length=200, min_segment_length=50, auto_noise_gate=true, voiced_max_dB=150, voiced_min_dB=50, callback=null, test_play=true, file_label=[])
{
    spec_hist = null;
    segments_raw = null;
    segments_fm = null;
    formants_ft = null;
    segments_labels = null;
    syllables = null;
    syllables_ft = null;

    test_mode = test_play;
    if(test_mode==false) callback_func = callback;
    
    return new Promise((resolve, reject)=>{
        if(spec_bands)
        {
            await_busy_last_process().then((value) => {
                
            s_set.process_level = process_level;
            s_set.spec_bands = spec_bands;
            s_set.plot_len = plot_len;
            s_set.seg_limit_1 = plot_len - 10;
            s_set.seg_limit_2 = plot_len - 4;
            s_set.max_voiced_bin = parseInt(spec_bands * 0.7);
            s_set.window_step = window_step/1000;   //s_set.window_step is in whole 'seconds' because it is used to calc start/end timings of seg
            s_set.seg_breaker = (pause_length>window_step*2)?pause_length/window_step:250/window_step;  //at least twice of window_step (or 250ms)
            s_set.seg_min_frames = parseInt(min_segment_length/window_step);   //minium segment size is 250ms, shorter segments sandwiched bw pauses will be ignored.

            

            s_set.current_label = file_label;
            
            s_set.play_end = false;
            s_set.no_fm_segs = 0;
            s_set.c_ci = 0;
            s_set.c_started = -1;
            spec_hist = [];         //2d array, rows=frames, cols=Mel/FFT bins
            s_set.current_frame = 0;
            s_set.callbacks_processed = 0;

            
            fm_mod.clear_fm();
            //fm = [];    //formants of current segment, it resets on each pause and the previous segment is added to 'segments_raw'
            segments_raw = [];  //2D array, rows=segments, cols=formants
            segments_fm = [];   //2D array, rows=segments, cols=formants
            segments_labels = [];   //2d array, segments, [labels,..]
            segments_ci = [];       //2d array, segments, [start, dur]

            
            formants_ft = [];
            syllables = [];
            syllables_ft = [];

            s_set.auto_noise_gate = auto_noise_gate;
            s_set.voiced_max_dB = voiced_max_dB;
            s_set.voiced_min_dB = voiced_min_dB;
            if(!s_set.auto_noise_gate)
            {
                context_maximum = Math.pow(10, s_set.voiced_max_dB/20);
                local_minimum = Math.pow(10, s_set.voiced_min_dB/20);
            }
            else
            {
                context_maximum = 50;
                local_minimum = 2;
            }
            max_history_len = 0;
            old_maxes_sum = 0;
            old_maxes_n = 0;
                        
            last_real_high = context_maximum;
            last_real_low = local_minimum;
            //fm_noise_residue = 0;
            //fm_voiced_energy = 0;

            temp_spec_hist = [];
            bins_in_process = false;

            //console.log(s_set);
            resolve("ready");
            });
        }
        else reject('Invalid spec_bands')
    });
}

var last_busy_count_up = 0;

function await_busy_last_process ()
{
    return new Promise((resolve)=>{
        if (last_busy_count_up>20) {last_busy_count_up=0; resolve(1); console.error("await_busy_last_process timeout");}
        else if(s_set.callbacks_processed < segments_ci.length)
        {
            last_busy_count_up++;
            setTimeout(() => {
                await_busy_last_process().then((value) => { resolve(1); });
                }, 500);
        }
        else if(s_set.callbacks_processed >= segments_ci.length)
        {
            last_busy_count_up=0;
            resolve(segments_ci.length);
        }
        });
}


function seg_reset(start_resist=-1)
{
    //called at each segment break
    //reset current segment's variables
    s_set.c_ci = 0;
    s_set.c_started = start_resist;
    s_set.no_fm_segs = 0;
    fm_mod.clear_fm();
}


async function peaks_n_valleys_process()
{
    //let seg_size = s_set.c_ci - s_set.no_fm_segs;
    //if(s_set.play_end)
    //console.log('pk ' + s_set.current_frame + '\t' + seg_size + '\t' + s_set.no_fm_segs);

    //The function recognizes the pauses in incoming data (spec_hist) and separates voiced segments by pauses of at least 6 frames. The output shape of segments is different from input array because input is Mel-bands as displayed on plot, but the output is composed of fixed number of formants per frame and their amplitudes (color), frequency(bin no), span, and number of voiced formants per frame. Output shape: (1 + (MAX_FORMANTS x 3)) x frames_in_segment.
    //play_end=true to truncate the current segment. It is used to truncate the very last segment of the audio file as it might not have the silent pause at the end.
    
    bins_in_process = true;
    while(temp_spec_hist.length  > 0)
    {
    let bins = temp_spec_hist.splice(0, 1)[0];
    
    let this_ci = s_set.c_ci;
    let c_fm = 0;   //count of peaks in current segment
    
    let j = 1;  // y axis index
    let up_s_j = 0;
    let pk_j = 0;
    let vl_j = 0;
    let plat_n = 0;
    let flag = 0;

    let peaks = [];
    let all_peaks_sum = 0;
    let h_peak_amp = local_minimum * 2;    //highest peak amp
    let h_peak_cf = 0;
    
    let ci_energy = 0;
    while(j < s_set.spec_bands) 
    {
        ci_energy += bins[j];
        if((bins[j] > bins[j-1]) && ((j<2) || bins[j] > bins[j-2]) && ((j<3) || bins[j] > bins[j-3]) )
        {   //if rising
            if((flag == -1) || (flag == 0))
            {
                if(flag == -1)
                {
                    //sum up last peak
                    if((bins[pk_j]  > local_minimum) && (up_s_j <= pk_j) && (pk_j < vl_j))
                    {
                        if(bins[pk_j] > h_peak_amp) 
                        {
                            h_peak_amp = bins[pk_j];
                            h_peak_cf = pk_j;
                        }
                        let p_10 = bins[pk_j]/10;
                        while((up_s_j < pk_j) && (bins[up_s_j] < p_10)) up_s_j++;
                        while((vl_j > pk_j) && (bins[vl_j] < p_10)) vl_j--;

                        peaks[c_fm] = [up_s_j, vl_j, pk_j];
                        c_fm++;
                        all_peaks_sum += bins[pk_j];
                    }
                }
                up_s_j = j - 1;
                pk_j = j;
            }
            else if(flag == 1)
            {
                pk_j = j;
            }
            flag = 1; //upwards
        }
        else if((bins[j] < bins[j-1]) && ((j<2) || bins[j] < bins[j-2]) && ((j<3) || bins[j] < bins[j-3]) )
        {   //if falling
            if((flag == 1) || (flag==-1))  //if was going upward
            {
                vl_j = j;
                flag = -1; //downward
            }
        }
        else    //plateau
        {
            if(flag==-1)
            {
                plat_n++;
                if(plat_n > 2)
                {
                    plat_n = 0;

                    //sum up last peak
                    if((bins[pk_j]  > local_minimum) && (up_s_j <= pk_j) && (pk_j < vl_j))
                    {
                        if(bins[pk_j] > h_peak_amp)
                        {
                            h_peak_amp = bins[pk_j];
                            h_peak_cf = pk_j;
                        }
                        let p_10 = bins[pk_j]/10;
                        while((up_s_j < pk_j) && (bins[up_s_j] < p_10)) up_s_j++;
                        while((vl_j > pk_j) && (bins[vl_j] < p_10)) vl_j--;
                        peaks[c_fm] = [up_s_j, vl_j, pk_j];
                        c_fm++;
                        all_peaks_sum += bins[pk_j];
                    }
                    flag = 0;
                }
            }
            else if((flag==1) && (bins[j] > bins[j-1]))
            {
                pk_j = j;
            }
        }

        if((j==s_set.spec_bands-1) && (flag==1))   //if ends while going up
        {
            //spec limit
            vl_j = j;
            pk_j = j;

            if((bins[pk_j]  > local_minimum) && (up_s_j < pk_j) && (pk_j <= vl_j))
            {
                let p_10 = bins[pk_j]/10;
                while((up_s_j < pk_j) && (bins[up_s_j] < p_10)) up_s_j++;
                while((vl_j > pk_j) && (bins[vl_j] < p_10)) vl_j--;

                peaks[c_fm] = [up_s_j, vl_j, pk_j];
                c_fm++;
                all_peaks_sum += bins[pk_j];
            }
        }

        j++;
    }

    if(s_set.c_started < 0)     //c_started is used to create a resistance for noise to be able to initiate a segment
    {
        let peak_ratio = (all_peaks_sum>h_peak_amp)?((h_peak_amp*(c_fm-1)/(all_peaks_sum - h_peak_amp))) : 0;
        //console.log(h_peak_amp +'\t'+all_peaks_sum+'\t'+(peak_ratio)) ;
        if((c_fm > 0) && (h_peak_cf > 7) && (h_peak_cf < s_set.max_voiced_bin) && ((c_fm>4) && (peak_ratio > 4))) 
        {
            
            seg_reset(0);
            s_set.c_started = 0;
        }
        else s_set.no_fm_segs++;
    }
    
    if( s_set.c_started>=0)
    {
        
        if((c_fm == 0) || (h_peak_cf < 7) || (h_peak_cf >= s_set.max_voiced_bin) ||  ((c_fm>3) && ((all_peaks_sum/(ci_energy - all_peaks_sum)) < 0.1))) 
        {
            
            //console.log((s_set.no_fm_segs) + '\t' + (local_minimum)+ '\t' + (context_maximum));
            //silent or noise
            s_set.no_fm_segs++;
            //c_started has to pass a barrier of 2 continuos voiced frames to be able to fully initiate a segment
            if(s_set.c_started < 2) s_set.c_started--;
            else if ((s_set.no_fm_segs >= s_set.seg_breaker) || ((break_at_limits) && (((s_set.c_ci > s_set.seg_limit_1) && (s_set.no_fm_segs >= 6)) || ((s_set.c_ci > s_set.seg_limit_1) && (s_set.no_fm_segs >= 4))) ) )
            {
                //check if pause is too long, then break the segment
                segment_cutter(s_set.c_ci + 1).then(function()
                {
                    seg_reset(-1);
                    if(s_set.call_at_end==false) handle_callback();    //calls the callback function from index.js if there are any features to send
                }).catch((err)=>{
                    seg_reset(-1);
                });
            }
            else if(s_set.auto_noise_gate) amplitude_control(h_peak_amp);
            
        }
        else
        {
            //console.log(h_peak_amp + '\t' + local_minimum + '\t' + (all_peaks_sum/(ci_energy - all_peaks_sum)));
            if(s_set.auto_noise_gate)
            amplitude_control(h_peak_amp);
            //console.log(this_ci);
            fm_mod.accumulate_fm(bins, peaks, this_ci, ci_energy, local_minimum);  //forward to formant collector mod
            if(s_set.c_started < 2) s_set.c_started++;
            else s_set.no_fm_segs = 0;
        }
    }
    
    s_set.c_ci++;
    peaks = null;
    
    //segmentor_process(false); //then detect pauses and segments
    }
    if((s_set.play_end) || ((break_at_limits) && (s_set.c_ci > s_set.plot_len - 4)))
    {
        segment_cutter(s_set.c_ci).then(function()
                {
                    seg_reset(1);
                    if(s_set.play_end) handle_callback();
                }).catch((err)=>{
                    seg_reset(1);
                });
    }
    bins_in_process = false;
    //return true;
}





function segment_cutter(current_ci)    //called from async peaks_n_valleys_process
{
    
    return new Promise((resolve, reject)=>{

    let seg_size = current_ci - s_set.no_fm_segs;   //s_set.ci is global var it changes quickly therefore pass it to function
    
    if((seg_size > s_set.seg_min_frames) && (s_set.c_started>=2))
    {
        let start_ci = s_set.current_frame - seg_size;
        let this_seg_fm = fm_mod.get_ranked_formants();
        
        
        //level 4 is raw segment formants, 5 is segment formant features, 6 is syllable formants, 7 is syllable features
        
        if(s_set.process_level==13) //syllable level formant features, 53
        {
            segments_ci.push([start_ci, seg_size]);

            let fm_simple = fm_mod.straighten_formants(this_seg_fm, seg_size, local_minimum); //[ci_fm_val, ci_all_val]
            let syls_buff = fm_mod.sep_syllables(fm_simple, local_minimum);
            let syls_fts = fm_mod.make_syl_features(syls_buff, context_maximum, local_minimum);

            segments_labels.push(s_set.current_label.slice());
            segments_raw.push(this_seg_fm);
            segments_fm.push(fm_simple[0]);
            formants_ft.push(null);
            syllables.push(syls_buff);
            syllables_ft.push(syls_fts);
            resolve(1);
            fm_simple = null;syls_buff=null;syls_fts=null;
        }
        else if(s_set.process_level==12) //syllable curves, 23-ish coefficients
        {
            segments_ci.push([start_ci, seg_size]);

            let fm_simple = fm_mod.straighten_formants(this_seg_fm, seg_size, local_minimum); //[ci_fm_val, ci_all_val]
            let syls_buff = fm_mod.sep_syllables(fm_simple, local_minimum);
            let syls_coeffs = fm_mod.make_coeffs(syls_buff);

            segments_labels.push(s_set.current_label.slice());
            segments_raw.push(this_seg_fm);
            segments_fm.push(fm_simple[0]);
            formants_ft.push(null);
            syllables.push(syls_buff);
            syllables_ft.push(syls_coeffs);
            resolve(1);
            fm_simple = null;syls_buff=null;syls_coeffs=null;
        }
        else if((s_set.process_level==10) || (s_set.process_level==11)) //syllable formants raw
        {
            segments_ci.push([start_ci, seg_size]);

            let fm_simple = fm_mod.straighten_formants(this_seg_fm, seg_size, local_minimum); //[ci_fm_val, ci_all_val]
            
            let syls_buff = fm_mod.sep_syllables(fm_simple, local_minimum);
            //returns 3 arrays, 1st array is the timestamps, 2nd array: formant specific, 3rd: overall

            segments_labels.push(s_set.current_label.slice());
            segments_raw.push(this_seg_fm);
            segments_fm.push(fm_simple[0]);
            formants_ft.push(null);
            syllables.push(syls_buff);
            resolve(1);
            fm_simple = null;syls_buff=null;
        }
        else if(s_set.process_level==5) //segment formant features, 53
        {
            segments_ci.push([start_ci, seg_size]);
            let fm_simple = fm_mod.straighten_formants(this_seg_fm, seg_size, local_minimum); //[ci_fm_val, ci_all_val]
            let fm_features = fm_mod.formant_features(fm_simple[0], context_maximum, local_minimum);  //array(40)
            segments_labels.push(s_set.current_label.slice());
            segments_raw.push(this_seg_fm);
            segments_fm.push(fm_simple[0]);
            formants_ft.push(fm_features);
            resolve(1);
            fm_simple = null;fm_features=null;
        }
        
        else if(s_set.process_level==4) //segment formants raw
        {
            
            segments_ci.push([start_ci, seg_size]);
            let fm_simple = fm_mod.straighten_formants(this_seg_fm, seg_size, local_minimum);
            segments_labels.push(s_set.current_label.slice());
            segments_raw.push(this_seg_fm);
            segments_fm.push(fm_simple[0]);
            resolve(1);
            fm_simple = null;
        }
        else if(s_set.process_level==3) //3 is segments
        {
            segments_ci.push([start_ci, seg_size]);
            segments_labels.push(s_set.current_label.slice());
            segments_raw.push(this_seg_fm);
            resolve(1);
        }
        else
        {
            console.error("Invalid process_level");
            reject(0);
        }
        
    }
    else if(seg_size > 1)
    {
        console.log((segments_ci.length)  +  ": seg_size:" + (seg_size) + ", ignored, too small < " + (s_set.seg_min_frames));
        resolve(0);
    }
    else
    {
        resolve(0);
    }
});
}



function amplitude_control(h_peak_amp)
{
    // this function determines the silence threshold, below which amplitude is considered as silent
    // Since, different environments has different amplitudes, it has to be determined based on the max amplitude

    max_history_len++;
    
    if((h_peak_amp > context_maximum) || ((max_history_len > 40) && (h_peak_amp > local_minimum * 2)))    //new maximum
    {
        
        if(h_peak_amp >= context_maximum)  
        {
            //console.log(h_peak_amp);
            max_history_len  = 0;
            context_maximum = h_peak_amp;
            last_real_high = context_maximum;
        }
        else  //if it came here due to  (max_history_len > 40) 
        {
            if(h_peak_amp > last_real_high/100)
            {
                context_maximum -= parseInt(context_maximum/8);
                max_history_len  = 35;
            }
        }
        let Max_log = Math.log10(context_maximum);
        
        if(Max_log > 7) local_minimum = parseInt(Math.pow(10, Max_log-3)/20);
        else if(Max_log > 6) local_minimum = parseInt(Math.pow(10, Max_log-3)/2);
        else if(Max_log > 4) local_minimum = parseInt(Math.pow(10, Max_log-2)/2);
        else if(Max_log > 2) local_minimum = parseInt(Math.pow(10, Max_log/3));
        else if(Max_log > 1) local_minimum = parseInt(context_maximum/10);
        else local_minimum = 1;
        last_real_low = local_minimum;
        //console.log(Max_log + '\t' + local_minimum);
        
        if((old_maxes_n > 0) && ((old_maxes_sum / old_maxes_n) < (local_minimum * 30)))
        {
            seg_reset(0);   //previous segment was probably noise, so reset it
            old_maxes_n = 0;
            old_maxes_sum = 0;
        }
        old_maxes_sum += context_maximum;
        old_maxes_n += 1;
    }
    else
    {
        if((local_minimum > 10) && (local_minimum > last_real_low/10) && (max_history_len > 20))
        {
            local_minimum -= parseInt(last_real_low/20);
            if(local_minimum < 10 ) local_minimum = 10; 
        }
    }
}



function handle_callback()
{
    //This async function is called after a segment/phoneme is added to the segments/phoneme list depends on the process_level.
    //syllables are a smaller unit so it sends phoneme every few milliseconds, segments are larger so expect one every half second
    //Segment index is also passed so that labels can be displayed on the plot accordingly.
    //Filename is passed so that if the main node has moved to next file, this previous file still retains the filename of current segment in order to extract its label.
    
    if(test_mode) return true;
    else if(s_set.spec_bands>0)
    {
        if(s_set.process_level == 11)    //syllable level features extraction for whole clip from 'utt_mod.get_utterance_features'
        {
            if(syllables.length > segments_ci.length) console.error("Array len mismatch");
            else
            {
                if(s_set.callbacks_processed < syllables.length)
                {
                    s_set.callbacks_processed = syllables.length;
                    const syls_ts = get_clip_timestamps();
                    const utt_features = utt_mod.get_utterance_features(segments_ci, syllables);
                    if(callback_func) callback_func(0, s_set.current_label, syls_ts, utt_features);
                }
            }
        }
        if((s_set.process_level == 12) || (s_set.process_level == 13))    //syllables curves or features
        {
            if(syllables_ft.length > segments_ci.length)  console.error("Array len mismatch");
            else
            {
                while(s_set.callbacks_processed < syllables_ft.length)
                {
                    s_set.callbacks_processed++;
                    let cl = s_set.callbacks_processed-1;
                    
                    if(syllables_ft[cl].length > 0)
                    {
                        if(callback_func) callback_func(cl, s_set.current_label, get_syls_timestamps(cl), syllables_ft[cl]);
                    }
                }
            }
        }
        else if(s_set.process_level == 10)    //syllable formants, backup, not used for now.
        {
            if(syllables.length > segments_ci.length)  console.error("Array len mismatch");
            else
            {
                while(s_set.callbacks_processed < syllables.length)
                {
                    s_set.callbacks_processed++;
                    let cl = s_set.callbacks_processed-1;
                    
                    if(syllables[cl][1].length > 0)
                    {
                        if(callback_func) callback_func(cl, s_set.current_label, get_syls_timestamps(cl), syllables[cl][1]);
                    }
                }
            }
        }
        else if(s_set.process_level == 5)    //syllables formants_ft
        {
            if(formants_ft.length > segments_ci.length)  console.error("Array len mismatch");
            else
            {
                while(s_set.callbacks_processed < formants_ft.length)
                {
                    s_set.callbacks_processed++;
                    let cl = s_set.callbacks_processed-1;
                    //console.log("handle_callback " + (cl) + '\t' + (formants_ft.length));
                    
                    if(formants_ft[cl].length > 0)          //only process segments with 2 or more scattered formants
                    {
                        if(callback_func) callback_func(cl, s_set.current_label, get_seg_timestamps(cl), formants_ft[cl]);
                    }
                }
            }
        }
        else if(s_set.process_level == 4)    //segment level formant, same size as segments, but sorted by frequency
        {
            if(segments_fm.length > segments_ci.length)  console.error("Array len mismatch");
            else
            {
                while(s_set.callbacks_processed < segments_fm.length)
                {
                    s_set.callbacks_processed++;
                    let cl = s_set.callbacks_processed-1;
                    if(segments_fm[cl].length > 0)          //only process segments with 2 or more scattered formants
                    {
                        if(callback_func) callback_func(cl, s_set.current_label, get_seg_timestamps(cl), segments_fm[cl]);
                        else console.warn('callback_func is not set');
                    }
                }
            }
        }
        else if(s_set.process_level == 3)    //segment level, needs update
        {
            while(s_set.callbacks_processed < segments_raw.length)
            {
                s_set.callbacks_processed++;
                let cl = s_set.callbacks_processed-1;
                if(segments_raw[cl].length > 0)          //only process segments with 2 or more scattered formants
                {
                    if(callback_func)
                        callback_func(cl, s_set.current_label, segments_raw[cl]);
                    else
                        console.log('callback_func is not set');
                }
            }
        }
        /*
        Need to change condition above: (s_set.callbacks_processed < segments_fm.length), because length will reduce after splice
        let len20 = segments_raw.length;
        if((segments_ci.length!=len20)||(segments_labels.length!=len20) ||((s_set.process_level >= 4) && (segments_fm.length!=len20)) || ((s_set.process_level >= 5)&&(phoneme_ft.length!=len20)) || ((s_set.process_level >= 5) && (phoneme_ci.length!=len20))  )
        {
            console.error("Segments arrays count mismatch ");
        }
        else if((s_set.process_level >= 3) && (len20 > MAX_SEGS))
        {
            s_set.callbacks_processed -= len20 - MAX_SEGS;
            //total 6 buffers\
            if(s_set.process_level >= 5) {phoneme_ft.splice(0, len20 - MAX_SEGS); phoneme_ci.splice(0, len20 - MAX_SEGS);}
            if(s_set.process_level >= 4) formants_ft.splice(0, len20 - MAX_SEGS);

            segments_fm.splice(0, len20 - MAX_SEGS);
            segments_raw.splice(0, len20 - MAX_SEGS);
            segments_ci.splice(0, len20 - MAX_SEGS);
            segments_labels.splice(0, len20 - MAX_SEGS);
        }*/
    }
    else
        console.warn('s_set.spec_bands is not set yet.')
    return true;
}



export function spectrum_push(new_bins, frame_n) /* AudioNodes.js forwards the bins of the latest sample frame here: */
{
    if(s_set.spec_bands == new_bins.length) //check if the input dimensions match the expected number of bins
    {
        //let seg_size = s_set.c_ci - s_set.no_fm_segs;
        //if(s_set.play_end)
        //console.log('push ' + s_set.current_frame + '\t' + seg_size + '\t' + s_set.no_fm_segs);
        
        s_set.current_frame++;

        if(s_set.process_level<=2)
        {
            spec_hist.push(new_bins);   //this is the most raw buffer used only for plotting
            if(s_set.process_level<=1) spec_hist.splice(0,spec_hist.length-1);
            else if(spec_hist.length > s_set.plot_len) spec_hist.splice(0,1);

            if(s_set.auto_noise_gate)
            {
                let this_max = stats.arrayMax(new_bins);  //low level amplitude control
                if(this_max > context_maximum) { context_maximum = this_max; max_history_len = 0; last_real_high=this_max;}
                else if((max_history_len>s_set.seg_limit_1) && (context_maximum>last_real_high/4)) {context_maximum *= 0.99;}
                else max_history_len++;
            }
        }
        else
        {
            //First, peaks_n_valleys_process extracts peaks and valleys and calls accumulate_fm to match to the peaks of previous formants
            //Then, segment_process adds the combined peaks to a raw_segment array when there is a pause or play end
            //Then, create_formants analyzes the collected peaks and extracts formants
            temp_spec_hist.push(new_bins);    //this is another raw buffer used for async processing in 'peaks_n_valleys_process'
            //if(bins_in_process==false) {bins_in_process=true; window.setTimeout(peaks_n_valleys_process, 10);}
            //window.setTimeout(peaks_n_valleys_process, 10);
            //async is used because there is no hurry
            if (bins_in_process==false) peaks_n_valleys_process();  //detect formants etc, then detect pauses and segments
        }
    }
    else
        console.error('Error: bins num mismatch ' + (s_set.spec_bands) + ', ' + (new_bins.length));
}

export function segment_truncate()
{
    
    window.setTimeout(function() {
        s_set.play_end  = true;
        //let seg_size = s_set.c_ci - s_set.no_fm_segs;
        //console.log("Last call\t" + s_set.current_frame + '\t' + seg_size);
    
        if (bins_in_process==false) peaks_n_valleys_process();  //true for truncating the segment at end
    }, 10);
    
}


export function get_context_maximum()
{
    return context_maximum/7;
}


export function get_spectrum()
{
    return spec_hist;
}

export function get_segment(index, type)    //type 3= segments_raw, 4= segments_fm
{
    if((type>=4) && (s_set.process_level>=4)) return segments_fm[index];
    else if(s_set.process_level>=3) return segments_raw[index];
    else return [];
}

export function get_syllables_ci(segment_index)
{
    return syllables[segment_index][0];
}

export function get_syllables_curves(segment_index)
{
    if((s_set.process_level==12))
    return syllables_ft[segment_index];
    else console.error("Invalid process level for syllable curves " + s_set.process_level);
    return null;
    
}


export function get_syls_timestamps(segment_index)  //start time and duration
{
    
   //console.log(syllables[segment_index][0]);
    const syls_len = syllables[segment_index][0].length;
    let syl_ts = [];
    try
    {
        for(let ph = 0; ph < syls_len; ph++ ) 
        {
            syl_ts[ph] = [];
            syl_ts[ph][0] = ((segments_ci[segment_index][0] + syllables[segment_index][0][ph][0]) * s_set.window_step).toFixed(3);
            syl_ts[ph][1] = ((syllables[segment_index][0][ph][1] + 1) * s_set.window_step).toFixed(3);
        }
    }
    catch(e) {console.error(e);}
    return syl_ts;
}

export function get_segments_ci(index)
{
    return segments_ci[index];
}

export function get_clip_timestamps()  //start time and duration
{
    const last_i = segments_ci.length;
    if(last_i > 0)
    {
        let sum_dur = 0;
        for (let i=0; i<last_i; i++) sum_dur+= segments_ci[i][1];
        return [(segments_ci[0][0]*s_set.window_step), ((sum_dur+1)*s_set.window_step)];
    }
    else return [0, 0];
    
}

export function get_seg_timestamps(index)  //start time and duration
{
    return [(segments_ci[index][0]*s_set.window_step), ((segments_ci[index][1]+1)*s_set.window_step)];
}

export function get_segments_count(type)
{
    if((type>=6) && (s_set.process_level>=6)) return segments_fm.length;    //return syllables
    else if((type>=4) && (s_set.process_level>=4)) return segments_fm.length;
    else if(s_set.process_level==3) return segments_raw.length;
    return 0;
}

export function get_segments_label(seg_index)
{
    return segments_labels[seg_index];
}

export function set_segments_label(seg_index, label_index, new_label)
{
    while(segments_labels[seg_index].length < label_index) {segments_labels[seg_index][segments_labels[seg_index].length] = -1};
    segments_labels[seg_index][label_index] = new_label;

    //console.log(seg_index + '\t set: ' + String(segments_labels));
    
}


