
const stats = require('./stats.js');
const fm_mod = require('./formants.js');



export function phonemes_features(ci_fm_phn)
{
    try
    {
        let phn_features_buff = [];
        for (let ph = 0; ph < ci_fm_phn.length; ph++)
        {
            phn_features_buff.push(fm_mod.formant_features(ci_fm_phn[ph]));
        }
        return phn_features_buff;
    }
    catch (e)
    {
        console.error(e);
        return null;
    }
}



export function sep_phonemes(ci_fm_val, ci_all_val, seg_size)
{
    
    //console.log(ci_all_val);
    //const fm_features_count = 3;
    //const max_fm = 3;//parseInt(ci_fm_val[0].length/fm_features_count);

    let ci_pos = [];
    let ci_fm_phn = [];
    //let ci_all_phn = null;
    let phn_st_ci = 0;
    let dir = 0;
    const rise_thresh = 10;
    const fall_thresh = 100;
    let last_max = 0;
    let last_min = 0;

    try
    {
        for(let ci = 0; ci < seg_size; ci++)
        {
            const ci_amp = ci_all_val[ci][1];
            if(dir==0)
            {
                if((ci<(seg_size-1)) && (ci_amp > rise_thresh) && (ci_all_val[ci+1][1] > rise_thresh))
                {
                    dir = 1;
                    phn_st_ci = ci;
                    last_max = ci_amp;
                    last_min = last_max;
                    
                }
            }
            else if(dir==1)
            {
                if(ci_amp> last_max)
                {
                    last_max = ci_amp;
                }
                else if((ci_amp < last_max/2) && ((ci>=(seg_size-1)) || (ci_all_val[ci+1][1] < last_max/2)) || (ci>=(seg_size-1)))
                {
                    //passed the peak
                    dir = 2;
                    if(ci_amp < last_min) last_min = ci_amp;
                }
            }
            if(dir==2)
            {
                if((ci >= seg_size-1) || ((ci_amp < fall_thresh) &&  ((ci < seg_size-1) || (ci_all_val[ci+1][1] < fall_thresh*2))) || ((ci < seg_size-1) && (ci_all_val[ci+1][1] > last_min)))
                {
                    dir = 0;
                    last_min = ci_amp;
                    const start_ci = phn_st_ci;
                    const phn_size = ci - phn_st_ci;
                    ci_pos.push([start_ci, phn_size]);
                    ci_fm_phn.push(ci_fm_val.slice(start_ci, ci));
                }
                else if(ci_amp < last_min) last_min = ci_amp;
            }
        }
    }
    catch(e)
    {
        console.error(e);
    }
    
    return [ci_pos, ci_fm_phn];

}














export function probs_calc_feb16(formants, seg_size)
{
    const bins_count = 64;
    const fm_features_count = 3;
    const max_fm = 3;//parseInt(ci_fm_val[0].length/fm_features_count);
    
    let bins_power = new Array(bins_count * max_fm).fill(0);
    let max_power = 0;

    for (let ci = 0; ci < seg_size; ci++)
    {

        for (let fr = 0; fr < max_fm; fr++)
        {
            let freq = formants[ci][fr*fm_features_count];
            if(freq > 0)
            {
                freq = parseInt(freq/2);
                bins_power[(fr * bins_count) + freq] += formants[ci][(fr * fm_features_count) + 1];
                if(bins_power[(fr * bins_count) + freq] > max_power) max_power = bins_power[(fr * bins_count) + freq];
            }
        }

    }
    if(max_power > 0)
    {
        //max_power = Math.log(max_power)*1000;
        
        for (let b=0; b < (bins_count*max_fm); b++)
        bins_power[b] = bins_power[b]/max_power;
        
    }
    
    return bins_power;
}

//retired functions:

export function straighten_formants_feb16(fm_order, seg_size, energy_limit)
{
    let fo = 0;
    let fo_st = 0;
    let fo_rank = 0;
    
    
    //let seg_size = s_set.c_ci; due to async, its a global var
    let ci_fo_bins = new Array(seg_size).fill(0);
    let ci_fo_span = new Array(seg_size).fill(0);
    let ci_fo_ener = new Array(seg_size).fill(0);

    
    let ci_ener = new Array(seg_size).fill(0);
    
    let fo_bins = [];
    let fo_span = [];
    let fo_ener = [];
    let fo_sum_en = 0;

    while(fo < fm_order.length)
    {
        let bw = 0;
        let bf = 0; //bin different from ci_fo_bins
        for(let cx = 0; cx < fm_order[fo][14]; cx++ )
        {
            let ci45 = fm_order[fo][7][cx];
            if(ci45 <= seg_size)
            {
                let bin = fm_order[fo][10][cx];
                //let enr = fm_order[fo][12][cx];
                for (let cix=0; cix<seg_size; cix++)
                {
                    if((ci_fo_ener[cix] > 0) && (ci_fo_bins[cix] > 0))
                    {
                        let dw48 = (Math.abs(seg_size - Math.abs(cix - ci45)) / seg_size); //bin ci difference
                        bw += dw48;
                        bf += Math.abs(bin - (ci_fo_bins[cix] / ci_fo_ener[cix])) * dw48;
                    }
                }
            }
        }
        
        //If not much difference
        if((bw > 0) && (bf/bw < 10))
        {
            fm_order[fo][16] = fo_rank - 1;
        }
        else
        {                
            if((fo_rank <= 2 ) && (fo_sum_en < energy_limit * 10) && (fo > 0))   //if previous formant two small, discard it
            {
                for(let fo2 = fo_st; fo2 < fo; fo2++ ) fm_order[fo2][16] = -1;
            }
            else
            {
                if(fo_rank>0)
                {
                    fo_bins[fo_rank - 1] = ci_fo_bins;
                    fo_span[fo_rank - 1] = ci_fo_span;
                    fo_ener[fo_rank - 1] = ci_fo_ener;
                }
                fo_rank++;
            }
            ci_fo_bins = new Array(seg_size).fill(0);
            ci_fo_span = new Array(seg_size).fill(0);
            ci_fo_ener = new Array(seg_size).fill(0);
            fo_sum_en = 0;
            
            fm_order[fo][16] = fo_rank - 1;
            fo_st = fo;
        }
        
        for(let cx = 0; cx < fm_order[fo][14]; cx++ )
        {
            let ci34 = fm_order[fo][7][cx];
            if(ci34<=seg_size)
            {
                let bin = fm_order[fo][10][cx];
                let enr = fm_order[fo][12][cx];
                let spn = fm_order[fo][9][cx]-fm_order[fo][8][cx]+1;
                ci_fo_bins[ci34] += (bin * enr);
                ci_fo_span[ci34] += (spn * enr);
                ci_fo_ener[ci34] += enr;
                ci_ener[ci34] += enr;
                
                fo_sum_en += enr;
            }
        }
        fo++;
    }
    
    if(fo_bins.length < fo_rank)    //fo_bins and fo_ener are 2D arrays hold the formant values at each ci
    {
        fo_bins[fo_rank - 1] = ci_fo_bins;
        fo_span[fo_rank - 1] = ci_fo_span;
        fo_ener[fo_rank - 1] = ci_fo_ener;  //use this to find stress points
    }

    for (let ci = 0; ci < seg_size; ci++)
    {
        for (let fr = 0; fr < fo_rank; fr++)
        {
            fo_bins[fr][ci] = (fo_ener[fr][ci] > 0) ? (fo_bins[fr][ci]/fo_ener[fr][ci]) : 0;
            fo_span[fr][ci] = (fo_ener[fr][ci] > 0) ? (fo_span[fr][ci]/fo_ener[fr][ci]) : 0;
        }
    }

    return [fo_bins, fo_span, fo_ener]
}

export function analyze_formant_feb16(fm_order, seg_size, energy_limit, len_limit) //not used
{
    //Huge a** function, Global vars used: fm_segments, fm_features
    //Step 1: Order formants by frequency
    //Step 2: Assign rank from lowest to highest, for ease of plotting, ignore low freq noise
    //Step 3: Two formants can have the same rank if they are in same frequency range
    //          All formants in the same range are collected in a horizontally window-wide array which is used to measure 
    //          mean weighted frequency at each frame step.
    //Step 4: Add the ranked formants to fm_segments[] buffer which is only used for plotting.
    //Part B
    //Step 5: Analysis of the window-wide array of each range-formant (includes individual formants) for extracting features like
    //        Energy, mean frequency, spans, slopes
    //Step 6: Push the features to fm_features[]
    return new Promise((resolve, reject)=>{

    //let energy_limit = fm_max_enr / 100;
    //let len_limit = fm_max_len / 10;
    let fo = 0;
    let fo_st = 0;
    let fo_rank = 0;
    
    
    //let seg_size = s_set.c_ci; due to async, its a global var
    let ci_fo_bins = new Array(seg_size).fill(0);
    let ci_fo_ener = new Array(seg_size).fill(0);
    let ci_all_bins = new Array(seg_size).fill(0);
    let ci_all_ener = new Array(seg_size).fill(0);
    let ci_all_span = new Array(seg_size).fill(0);
    let fo_bins = [];
    let fo_ener = [];
    let fo_sum_en = 0;
    //assign collective ranks to formants. Those which have <6 difference in frequency are assigned the same formant rank
    while(fo < fm_order.length)
    {
        //filter out the low energy formants
        if((fm_order[fo][14] < len_limit) || ((fm_order[fo][13] / fm_order[fo][14]) < energy_limit)) fm_order.splice(fo, 1);
        else
        {
            let bw = 0; //bin weight
            let bf = 0; //bin
            for(let cx = 0; cx < fm_order[fo][14]; cx++ )
            {
                let ci45 = fm_order[fo][7][cx];
                if(ci45 <= seg_size)
                {
                    let bin = fm_order[fo][10][cx];
                    //let enr = fm_order[fo][12][cx];
                    for (let cix=0; cix<seg_size; cix++)
                    {
                        if((ci_fo_ener[cix] > 0) && (ci_fo_bins[cix] > 0))
                        {
                            let dw48 = (Math.abs(seg_size - Math.abs(cix - ci45)) / seg_size);
                            bw += dw48;
                            bf += Math.abs(bin - (ci_fo_bins[cix] / ci_fo_ener[cix])) * dw48;
                        }
                    }
                }
            }
            //assign rank based freq
            if((bw > 0) && (bf/bw < 6))
            {
                fm_order[fo][16] = fo_rank - 1;
            }
            else
            {                
                if((fo_rank <= 2 ) && (fo_sum_en < energy_limit * 10) && (fo > 0))   //if previous formant two small, discard it
                {
                    for(let fo2 = fo_st; fo2 < fo; fo2++ ) fm_order[fo2][16] = -1;
                }
                else
                {
                    if(fo_rank>0)
                    {
                        fo_bins[fo_rank - 1] = ci_fo_bins;
                        fo_ener[fo_rank - 1] = ci_fo_ener;
                    }
                    fo_rank++;
                }
                ci_fo_bins = new Array(seg_size).fill(0);
                ci_fo_ener = new Array(seg_size).fill(0);
                fo_sum_en = 0;
                
                fm_order[fo][16] = fo_rank - 1;
                fo_st = fo;
            }
            
            for(let cx = 0; cx < fm_order[fo][14]; cx++ )
            {
                let ci34 = fm_order[fo][7][cx];
                if(ci34<=seg_size)
                {
                    let bin = fm_order[fo][10][cx];
                    let enr = fm_order[fo][12][cx];
                    let spn = fm_order[fo][9][cx]-fm_order[fo][8][cx]+1;
                    ci_fo_bins[ci34] += (bin * enr);
                    ci_fo_ener[ci34] += enr;
                    ci_all_bins[ci34] += (bin * enr);
                    ci_all_ener[ci34] += enr;
                    ci_all_span[ci34] += (spn * enr);
                    fo_sum_en += enr;
                }
                //else console.log((seg_size) + '\t' + (seg_size));
            }
            fo++;
        }
    }
    if(fo_bins.length < fo_rank)    //fo_bins and fo_ener are 2D arrays hold the formant values at each ci
    {
        fo_bins[fo_rank - 1] = ci_fo_bins;
        fo_ener[fo_rank - 1] = ci_fo_ener;  //use this to find stress points
    }
    
    
    
    //trim start and end silence
    let ci54 = 0;
    while(ci54 < seg_size - 1)
    {
        if((ci_all_ener[ci54] > energy_limit) && (ci_all_ener[ci54 + 1] > energy_limit/100)) break;
        else ci54++;
    }
    let real_ci_start = ci54;
    ci54 = seg_size;
    while(ci54 > real_ci_start + 1)
    {
        if((ci_all_ener[ci54 - 1] > energy_limit) && (ci_all_ener[ci54 - 2] > energy_limit/100)) break;
        else ci54--;
    }
    let real_ci_end = ci54;
    let real_seg_len = real_ci_end - real_ci_start;

    ci_all_ener = ci_all_ener.slice(real_ci_start, real_ci_end);
    ci_all_bins = ci_all_bins.slice(real_ci_start, real_ci_end);
    ci_all_span = ci_all_span.slice(real_ci_start, real_ci_end);
    
    //features for each formant

    //at least 2 formants, some duration, some energy
    if((fo_rank > 0) && (real_seg_len > s_set.seg_min_frames) && (energy_limit > 1))
    {
        
        /*
        Part B: create feature set
        - avg individual fm length in the formant band
        - f0 cover. f1 cover
        - f1 span
        - fm dispersion. mean ci std of big fms
        - fo / seg_size
        - fo_rank
        - individual fm metallicity. del change in fm_pk
        */
       if(s_set.process_level >= 4) //5 is for phoneme_ft
       {
            formants_ft.push([]);

            formants_by_formant(formants_ft.length-1, fo_bins, fo_ener, fo_rank, real_seg_len, real_ci_start, real_ci_end, fm_max_enr, ci_all_ener, ci_all_bins, ci_all_span).then(function()
            {
                fm_segments.push(fm_order); //process level 3
                resolve(1);
            }).catch((err)=>{
                reject(err);
            });
        }
        else
        {
            fm_segments.push(fm_order); //process level 3
            resolve(1);
        }
    }
    else
    {
        reject("Segment too small or too quite " + (fo_rank) + ", " + (real_seg_len) + ", " + (energy_limit));
    }
});
    //return fm_order;
}



function formants_by_formant_feb16(seg_index, fo_bins, fo_ener, fo_rank, real_seg_len, real_ci_start, real_ci_end, fm_max_enr, ci_all_ener, ci_all_bins, ci_all_span)
{
    return new Promise((resolve, reject)=>{
    //let fo_features = [];
    let ci_fm_cover = new Float32Array(real_seg_len).fill(0);
    
    let ci_f0_freq = new Float32Array(real_seg_len).fill(0);  //dominant formant's frequency at ci
    //let ci_span = new Array(real_seg_len).fill(0);  //dominant formant's span at ci
    let ci_f0_ener = new Float32Array(real_seg_len).fill(0);  //dominant formant's energy
    let ci_f0_fo = new Float32Array(real_seg_len).fill(0);  //dominant formant rank at this ci
    
    let ci_f1_freq = new Float32Array(real_seg_len).fill(0);  //f0
    let ci_f1_ener = new Float32Array(real_seg_len).fill(0);  //f0
    //Note: add to plots
    
    
    let ci_slope = new Float32Array(real_seg_len).fill(0);

    //calculate the dominant formant and slopes
    for (let fr = 0; fr < fo_rank; fr++)
    {
        let last_ci_mean = 0;
        let slope_diff = [];
        let last_slope_ci = 0;
        
        for(let ci55=real_ci_start; ci55<real_ci_end;ci55++)
        {
            if((fo_bins[fr][ci55] > 0) && (fo_ener[fr][ci55]>0))    //fo_bins and fo_ener are the avg freq and ener of this formant at this ci
            {
                let r_ci = ci55 - real_ci_start;
                ci_fm_cover[r_ci] += (fr+1) * fo_ener[fr][ci55];
                
                if(last_ci_mean==0) last_ci_mean = (fo_bins[fr][ci55]/fo_ener[fr][ci55]);
                else if( ci55 > real_ci_start)
                {
                    let this_fo_mean = (fo_bins[fr][ci55]/fo_ener[fr][ci55])    //avg freq of formant if multiple bins at the current ci
                    //fm_bins_diff += this_fo_mean - last_ci_mean;
                    slope_diff.push(this_fo_mean - last_ci_mean);
                    last_ci_mean = this_fo_mean;
                    last_slope_ci = ci55;
                    
                    if(slope_diff.length>3)
                    {
                        let local_slope = stats.arraySum(slope_diff);
                        ci_slope[r_ci] += local_slope*fo_ener[fr][ci55];
                        slope_diff.splice(0, 1);
                    }
                }
            }
            if(((ci55 - last_slope_ci) > 2) && (slope_diff.length>0)) slope_diff = [];
         
            //update calc pitch and perceived energy at each ci
            let r_ci = ci55 - real_ci_start;
            if((fo_ener[fr][ci55] > 0) && ( fo_ener[fr][ci55] > ci_f0_ener[r_ci]) )
            {
                if((r_ci > 1) && (ci_f0_fo[r_ci-1]!=fr) && (fo_ener[fr][ci55+1] < ci_f0_ener[r_ci+1]))  //resist change in dominance of formants
                {
                    ci_f0_ener[r_ci] = fo_ener[fr][ci55];
                    ci_f0_freq[r_ci] = fo_bins[fr][ci55] / fo_ener[fr][ci55];
                    ci_f0_fo[r_ci] = ci_f0_fo[r_ci - 1];
                }
                else
                {
                    ci_f0_ener[r_ci] = fo_ener[fr][ci55] ;
                    ci_f0_freq[r_ci] = fo_bins[fr][ci55] / fo_ener[fr][ci55];
                    ci_f0_fo[r_ci] = fr;
                }
            }
            if((fo_ener[fr][ci55] > 0) && ( fo_ener[fr][ci55] > ci_f1_ener[r_ci]) && ( ci_f0_fo[r_ci] != fr))
            {
                ci_f1_ener[r_ci] = fo_ener[fr][ci55] ;
                ci_f1_freq[r_ci] = fo_bins[fr][ci55] / fo_ener[fr][ci55];
            }
        }
    }

    
    for (let r_ci=0;r_ci<real_seg_len;r_ci++)
    {
        //energy based avg
        let div_ener = ci_all_ener[r_ci] > 0 ? ci_all_ener[r_ci] : 1;
        ci_all_bins[r_ci] /= div_ener;
        ci_all_span[r_ci] /= div_ener;
        ci_fm_cover[r_ci] /= div_ener;
        ci_slope[r_ci] /= div_ener;

        ci_all_ener[r_ci] -= ci_f0_ener[r_ci];
        ci_all_ener[r_ci] -= ci_f1_ener[r_ci];

        
        formants_ft[seg_index].push([ci_f0_freq[r_ci], 20*Math.log10(ci_f0_ener[r_ci]), ci_f1_freq[r_ci], 20*Math.log10(ci_f1_ener[r_ci]), ci_f0_freq[r_ci], 20*Math.log10(ci_all_ener[r_ci]), ci_all_bins[r_ci], ci_all_span[r_ci], ci_slope[r_ci], 20*Math.log10([r_ci])]);
    }

    //console.log(formants_ft[seg_index]);

    if(s_set.process_level >= 5) //5 is for phoneme_ft
    {
        phoneme_ft.push([]);
        phoneme_ci.push([]);
        phoneme_calc(seg_index, ci_all_ener, ci_all_bins, ci_all_span, ci_f0_ener, ci_f0_freq, ci_f1_ener, ci_f1_freq, ci_slope, ci_fm_cover, real_ci_start, real_seg_len, fm_max_enr).then(function()
        {
            resolve(1);
        }).catch((err)=>{
            reject(err);
        });;
    }
    else
    {
        resolve(1);
    }
    
    /*
    formant_general(real_seg_len, fo_features, fm_max_enr, ci_fm_cover, ci_f0_freq, ci_f0_shifts, ci_all_ener.splice(real_ci_start, real_ci_end)).then(function()
    {
        resolve(1);
    }).catch((err)=>{
        reject(err);
    });;
    */
});
}



function phoneme_calc_feb16(seg_index, ci_ener, ci_freq, ci_span, ci_f0_ener, ci_f0_freq, ci_f1_ener, ci_f1_freq, ci_slope, ci_fm_cover, real_ci_start, real_seg_len, fm_max_enr)
{
    //divide slopes by pivot points
    //let buff = [];
    return new Promise((resolve, reject)=>{
    let st_ci = 0;
    let sum_ener = 0;
    let avg_span = 0;   //energy weighted avg of bandwidth spans of formants
    let avg_freq = 0;
    let dom_ener = 0;   //ratio of energy of dominant formants by energy of all formants
    let dom_freq = 0;   //frequency of dominant formant, pitch, averaged across temporal frames by energy weights
    let sec_ener = 0;   //ratio of energy of second formant's by energy of all formants
    let sec_freq = 0;   //frequency of second formant, pitch, averaged across temporal frames by energy weights

    let sl_val = [0,0,0];   //slopes at temporal start, mid, end of the phoneme
    let sl_en = [0,0,0];    //first these arrays store slopes by indices of upward, downward, no_slope order
    let sl_ci = [0,0,0];    //then up, dn, no slopes are ordered by their average time
    let fm_cover = 0;       //weighted avg of formant count, more formant with high energy, higher this value
    let voice_quality = (fm_noise_residue > 0) ? Math.round(100*fm_voiced_energy/(fm_voiced_energy+fm_noise_residue)) : 100;
    //vars
    let dir = 0;
    let last_max = 0;       //max energy over sum energy is used to calc peak stress
    let last_min = 0;       //min max are used to find peak and valleys in order to separate phonemes from each other
    let valley_limit = fm_max_enr/100;
    for (let r_ci=0;r_ci<real_seg_len;r_ci++)
    {
        if(dir==0)      //temporal ups and downs in energy, separate phonemes by valleys
        {
            if(ci_ener[r_ci] > valley_limit)
            {
                dir = 1;
                st_ci = r_ci;
                sum_ener = ci_ener[r_ci];
                avg_freq = ci_freq[r_ci] * ci_ener[r_ci];
                avg_span = ci_span[r_ci] * ci_ener[r_ci];
                dom_freq = ci_f0_freq[r_ci] * ci_f0_ener[r_ci];
                dom_ener = ci_f0_ener[r_ci];
                sec_freq = ci_f1_freq[r_ci] * ci_f1_ener[r_ci];
                sec_ener = ci_f1_ener[r_ci];
                fm_cover = ci_fm_cover[r_ci] * ci_ener[r_ci];
                let lcl_slp = ci_slope[r_ci];     //no need to divide, check again
                if(lcl_slp > 2) { sl_val[0] += ci_slope[r_ci]; sl_en[0] += ci_ener[r_ci]; sl_ci[0]+=(1+r_ci)*ci_ener[r_ci];}
                else if(lcl_slp < -2) { sl_val[1] += ci_slope[r_ci]; sl_en[1] += ci_ener[r_ci]; sl_ci[1]+=(1+r_ci)*ci_ener[r_ci];}
                else { sl_val[2] += 0; sl_en[2] += ci_ener[r_ci]; sl_ci[2]+=(1+r_ci)*ci_ener[r_ci];}
                
                last_max = ci_ener[r_ci];
            }
        }
        else if(dir==1)
        {
            if(ci_ener[r_ci] >= last_max)
            {
                last_max = ci_ener[r_ci];
            }
            else if(ci_ener[r_ci] < last_max/2) //passed the peak
            {
                dir = 2;
            }
            if(ci_ener[r_ci] > 0)
            {
                sum_ener += ci_ener[r_ci];
                avg_freq += ci_freq[r_ci] * ci_ener[r_ci];
                avg_span += ci_span[r_ci] * ci_ener[r_ci];
                dom_freq += ci_f0_freq[r_ci] * ci_f0_ener[r_ci];
                dom_ener += ci_f0_ener[r_ci];
                sec_freq += ci_f1_freq[r_ci] * ci_f1_ener[r_ci];
                sec_ener += ci_f1_ener[r_ci];
                fm_cover += ci_fm_cover[r_ci] * ci_ener[r_ci];
                
                let lcl_slp = ci_slope[r_ci];
                if(lcl_slp > 2) { sl_val[0] += ci_slope[r_ci]; sl_en[0] += ci_ener[r_ci]; sl_ci[0]+=(1+r_ci)*ci_ener[r_ci];}
                else if(lcl_slp < -2) { sl_val[1] += ci_slope[r_ci]; sl_en[1] += ci_ener[r_ci]; sl_ci[1]+=(1+r_ci)*ci_ener[r_ci];}
                else { sl_val[2] += 0; sl_en[2] += ci_ener[r_ci]; sl_ci[2]+=(1+r_ci)*ci_ener[r_ci];}
            
            }
        }
        else if(dir==2)
        {
            if(ci_ener[r_ci]>valley_limit)
            {
                sum_ener += ci_ener[r_ci];
                avg_freq += ci_freq[r_ci] * ci_ener[r_ci];
                avg_span += ci_span[r_ci] * ci_ener[r_ci];
                dom_freq += ci_f0_freq[r_ci] * ci_f0_ener[r_ci];
                dom_ener += ci_f0_ener[r_ci];
                sec_freq += ci_f1_freq[r_ci] * ci_f1_ener[r_ci];
                sec_ener += ci_f1_ener[r_ci];
                fm_cover += ci_fm_cover[r_ci] * ci_ener[r_ci];
                if(ci_ener[r_ci]>0)
                {
                    let lcl_slp = ci_slope[r_ci];
                    if(lcl_slp > 2) { sl_val[0] += ci_slope[r_ci]; sl_en[0] += ci_ener[r_ci]; sl_ci[0]+=(1+r_ci)*ci_ener[r_ci];}
                    else if(lcl_slp < -2) { sl_val[1] += ci_slope[r_ci]; sl_en[1] += ci_ener[r_ci]; sl_ci[1]+=(1+r_ci)*ci_ener[r_ci];}
                    else { sl_val[2] += 0; sl_en[2] += ci_ener[r_ci]; sl_ci[2]+=(1+r_ci)*ci_ener[r_ci];}
                }
            }

            if((ci_ener[r_ci]<valley_limit) || (r_ci >= real_seg_len-1) || ( (r_ci < real_seg_len-1) && (ci_ener[r_ci+1] < valley_limit)))
            {
                let ci_dist = (r_ci - st_ci);
                let ci_start = (real_ci_start + st_ci);
                let peak_stress = Math.round(last_max*100/sum_ener);
                let avg_stress = Math.round((sum_ener*100/ci_dist)/fm_max_enr);    //energy per frame
                avg_freq = Math.round((avg_freq/sum_ener));  //calc difference from the dom frequency
                avg_span = Math.round((avg_span/sum_ener)*10);    //energy of span is taken into account
                dom_freq = (dom_ener>0) ? Math.round(dom_freq/dom_ener) : 0;
                dom_ener = Math.round(dom_ener*10/sum_ener);
                sec_freq = (sec_ener>0) ? Math.round(sec_freq/sec_ener) : 0;
                sec_ener = Math.round(sec_ener*10/sum_ener);
                fm_cover = Math.round(fm_cover*10/sum_ener);

                for (let sk=0;sk<3;sk++) sl_ci[sk] = (sl_en[sk]>0) ? sl_ci[sk]/sl_en[sk] : 0;
                for (let sk=0;sk<3;sk++) sl_val[sk] = (sl_en[sk]>0) ? Math.round(sl_val[sk]/sl_en[sk]) : 0;
                for (let sk=0;sk<3;sk++) sl_en[sk] = (sl_en[sk]>0) ? Math.round(Math.sqrt((sl_en[sk]/fm_max_enr))*10) : 0;
                
                //sl_ci = [up_slope_ci,dn_slope_ci,no_slope_ci];
                let sl_ci_sorted = sl_ci.slice().sort(function(a,b){return b-a})
                //decreasing order in time, low ci (time), high rank in arry
                let sl_order = sl_ci.map(function(v){ if(v>0)return sl_ci_sorted.indexOf(v);else return -1;});

                let slps_ord = sl_order.map(function(v){ return (v>=0)?sl_val[v]:0;}); //order slopes based on temporal order
                let slps_enr = sl_order.map(function(v){ return (v>=0)?sl_en[v]:0;}); 

                sum_ener = Math.round(Math.sqrt(sum_ener/fm_max_enr)*10);
                
                //no_slope_ener = Math.sqrt(no_slope_ener/fm_max_enr);
                phoneme_ft[seg_index].push([ci_dist, sum_ener, avg_freq, dom_freq, dom_ener, sec_freq, sec_ener, fm_cover, avg_span, slps_ord[2], slps_enr[2], slps_ord[1], slps_enr[1], slps_ord[0], slps_enr[0], avg_stress, peak_stress, voice_quality]);

                phoneme_ci[seg_index].push([ci_start, ci_dist]);

                //console.log([ci_dist, sum_ener, avg_freq, dom_freq, dom_ener, sec_freq, sec_ener, fm_cover, avg_span, slps_ord[2], slps_enr[2], slps_ord[1], slps_enr[1], slps_ord[0], slps_enr[0], avg_stress, peak_stress, voice_quality]);
                //console.log(dom_freq+ '\t' + sec_freq);
                sum_ener = 0;
                sl_val = [0,0,0];
                sl_en = [0,0,0];
                sl_ci = [0,0,0];
                last_min = ci_ener[r_ci];
                dir = 3;
            }
        }
        else if(dir==3)
        {
            if(ci_ener[r_ci] < last_min ) last_min = ci_ener[r_ci];
            else if((r_ci < real_seg_len-1) && (ci_ener[r_ci+1] > last_min))
                dir = 0;
        }
    }
    //if(!s_set.play_end) phoneme_ft[seg_index].push(new Array(18).fill(0))   //blank array for pause
    resolve(1);
});
    //return buff;
}


