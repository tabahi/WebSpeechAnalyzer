

const stats = require('./stats.js');

//constants
const cf_st = 0;
const cf_en = 1;
const ci_st = 2;
const ci_en = 3;
const ci_slp = 4;
const cf_lim = [3,4,6,9];   //set according to number of mel bins = 128, set double for 256, and the window step length
const ci_max_dist = cf_lim.length;


var fm = [];    //array to hold formant details in the current segments, resets on pause
let fm_noise_residue = 0
let fm_voiced_energy = 0



export function formant_features(formants)
{
    try
    {
        const seg_size= formants.length;
        const fm_features_count = 3;
        const max_fm = 3;//parseInt(ci_fm_val[0].length/fm_features_count);
        
        let fm_avg_lens = new Array(max_fm).fill(0);
        let fm_i_counts = new Array(max_fm).fill(0);
        let slp_ups = new Array(max_fm).fill(0);
        let slp_dns = new Array(max_fm).fill(0);

        
        let freq_mean = new Array(max_fm).fill(0);
        let freq_std = new Array(max_fm).fill(0);
        let ener_rate = new Array(max_fm).fill(0);    //spread over complete seg
        let ener_voice = new Array(max_fm).fill(0);  //spread over only the voiced parts
        let span_mean = new Array(max_fm).fill(0);

        let peaks_count = new Array(max_fm).fill(0);
        let peaks_mean = new Array(max_fm).fill(0);
        let peaks_relh = new Array(max_fm).fill(0); //relative mean height of peak energies compared to average energy
        let peaks_std = new Array(max_fm).fill(0);

        for (let fr = 0; fr < max_fm; fr++) 
        {
            
            let fm_on = false;
            let freq_array = [];
            let freq_array_nw = [];
            let ener_array = [];
            let span_array = [];

            let energy_peaks = [];
            let energy_dir = 0;
            let energy_peak = 0;
            
            for(let ci = 0; ci < seg_size; ci++)
            {
                
                let freq = formants[ci][fr*fm_features_count];
                let ener = formants[ci][fr*fm_features_count + 1];
                if((freq > 0) && (ener > 0))
                {
                    let span = formants[ci][fr*fm_features_count + 2];
                    
                    freq_array.push(freq * ener);
                    freq_array_nw.push(freq);
                    span_array.push(span * ener);
                    ener_array.push(ener);


                    if(fm_on)
                    {
                        let diff = freq - formants[ci-1][(fr * fm_features_count)];
                        if( diff > 1)
                        {
                            slp_ups[fr] += diff;
                        }
                        else if( diff < -1)
                        {
                            slp_dns[fr] += diff*-1;
                        }

                        if(ener > energy_peak)
                        {
                            energy_peak = ener;
                            energy_dir = 1;
                        }
                        else if((energy_dir == 1 ) && (ener < (energy_peak/2)))
                        {
                            if(energy_peak > 10) energy_peaks.push(energy_peak);
                            energy_peak = 0;
                            energy_dir = -1;
                        }
                    }

                    if(!fm_on) fm_i_counts[fr] += 1;
                    fm_on = true;
                    fm_avg_lens[fr] += 1;
                }
                else
                {
                    fm_on = false;
                    energy_dir = 0;
                    energy_peak = 0;
                }
            }
            
            if(fm_i_counts[fr] > 0)
            {
                slp_ups[fr] /= fm_i_counts[fr]; //div by formant i counts
                slp_dns[fr] /= fm_i_counts[fr];

                let ener_sum = stats.arraySum(ener_array);
                ener_rate[fr] = Math.sqrt( ener_sum / seg_size );
                ener_voice[fr] = Math.sqrt( ener_sum / fm_avg_lens[fr]) ;
                freq_mean[fr] = stats.arraySum(freq_array) / ener_sum;
                freq_std[fr] = stats.only_std_NZ(freq_array_nw);
                span_mean[fr] = stats.arraySum(span_array) / ener_sum;

                

                peaks_count[fr] = energy_peaks.length;
                if(peaks_count[fr] > 0)
                {
                    let peaks_mean_std = stats.mean_std_NZ(energy_peaks);
                    peaks_mean[fr] = Math.sqrt(peaks_mean_std[0]);
                    peaks_std[fr] = Math.sqrt(peaks_mean_std[1]) / peaks_mean[fr];
                    
                    peaks_relh[fr] = peaks_mean[fr] / ener_voice[fr];

                    peaks_count[fr] /= fm_i_counts[fr];
                }
                
                fm_avg_lens[fr] /= fm_i_counts[fr];
                //fm_i_counts[fr] = fm_i_counts[fr] * 10 / seg_size;
            }
        }
        let buff = [];
        buff.push(seg_size);
        for (let fr = 0; fr < max_fm; fr++) 
        {
            //console.log(freq_mean[fr] + '\t' + freq_std[fr] + '\t' + span_mean[fr] + '\t' + fm_i_counts[fr] + '\t' + slp_ups[fr] + '\t' + slp_dns[fr]);
            buff.push(freq_mean[fr]);
            buff.push(freq_std[fr]);
            buff.push(ener_rate[fr]);
            buff.push(ener_voice[fr]);
            buff.push(span_mean[fr]);
            buff.push(fm_avg_lens[fr]);
            buff.push(fm_i_counts[fr]);
            buff.push(slp_ups[fr]);
            buff.push(slp_dns[fr]);

            buff.push(peaks_count[fr]);
            buff.push(peaks_mean[fr]);
            buff.push(peaks_std[fr]);
            buff.push(peaks_relh[fr]);
        }
        
        return buff;
    }
    catch (e)
    {
        console.error(e);
        return null;
    }
}





export function straighten_formants(fm_order, seg_size, energy_limit)
{
    //changes the shape of fm_order to [time x formant_rank]

    const max_fm = 6;
    const cf_max_dist = 10;
    const fm_features_count = 3; //For array init. This function returns max_fm x 3 features
    
    //let seg_size = s_set.c_ci; due to async, its a global var
    
    let ci_fm_val = [];
    let ci_all_val = [];
    let avg_run_freq = [];
    let avg_sum_ener = [];

    for (let ci=0; ci<seg_size; ci++)
    {
        //3 features for each formants, 0=freq, 1=energy, 2=span
        
        ci_fm_val.push( new Array(max_fm*fm_features_count).fill(0) );
        ci_all_val.push( new Array(fm_features_count).fill(0) );
        
        avg_run_freq.push(new Int32Array(max_fm).fill(0) );
        avg_sum_ener.push(new Int32Array(max_fm).fill(0) );
    }
    
    for (let fo = 0; fo < fm_order.length; fo++)
    {
        for(let cx = 0; cx < fm_order[fo][14]; cx++ )
        {
            const fm_ci = fm_order[fo][7][cx];
            
            const bin = fm_order[fo][10][cx];
            let enr = fm_order[fo][12][cx];
            let break_here = false;
            for (let fr=0; fr<max_fm; fr++)
            {
                let fm_freq_i = (fr*3);
                let fm_ener_i = (fr*3)+1;
                let fm_span_i = (fr*3)+2;
                
                if( (avg_sum_ener[fm_ci][fr] < energy_limit) || (  Math.abs(bin - (avg_run_freq[fm_ci][fr]/avg_sum_ener[fm_ci][fr])) < cf_max_dist )  )
                {
                    if (ci_fm_val[fm_ci][fm_ener_i] == 0)
                    {
                        break_here = true;
                    }
                    else if  (ci_fm_val[fm_ci][fm_ener_i] < enr)
                    {
                        for(let fm_last = max_fm-1; fm_last>fr; fm_last--)  //shift up
                        {
                            ci_fm_val[fm_ci][(fm_last*3)] = ci_fm_val[fm_ci][((fm_last-1)*3)]
                            ci_fm_val[fm_ci][(fm_last*3)+1] = ci_fm_val[fm_ci][((fm_last-1)*3)+1]
                            ci_fm_val[fm_ci][(fm_last*3)+2] = ci_fm_val[fm_ci][((fm_last-1)*3)+2]
                        }
                        break_here = true;
                    }
                    if(break_here)
                    {
                        const fm_span_val = fm_order[fo][9][cx]-fm_order[fo][8][cx]+1;

                        ci_fm_val[fm_ci][fm_freq_i] = bin;
                        ci_fm_val[fm_ci][fm_ener_i] = enr;
                        ci_fm_val[fm_ci][fm_span_i] = fm_span_val;

                        avg_run_freq[fm_ci][fr] += bin*enr;
                        avg_sum_ener[fm_ci][fr] += enr;

                        //if(isNaN(enr))
                        //console.log(fm_order[fo]);
                        //enr /= 1000;
                        
                        ci_all_val[fm_ci][0] += bin * enr;
                        ci_all_val[fm_ci][1] += enr;
                        ci_all_val[fm_ci][2] += fm_span_val * enr;

                        
                        break;
                    }
                }
            }
        }
    }
    return [ci_fm_val, ci_all_val];

}



export function get_ranked_formants()
{
    let fm_order = [];
    const min_len = 3;
    const min_freq = 7;
    //let fm_max_len = 0; //max length of a fomant found
    //let fm_max_enr = 0; //max energy per ci of a formant
    
    //sort out formants from lowest to highest mean freq
    for(let xf = 0; xf < fm.length; xf++ )
    {
        let fm_len = fm[xf][14];
        if(fm_len >= min_len)
        {
            let unw_mean_f = fm[xf][15] / fm[xf][13];
            if(unw_mean_f >= min_freq)  //filter out low frequency noise
            {
                //let fm_enr = fm[xf][13] / fm[xf][14];
                let fo = 0;
                if(fm_order.length == 0)  fm_order.push(fm[xf]);
                else
                {
                    while(fo < fm_order.length)
                    {
                        if((fm_order[fo][15] / fm_order[fo][13]) > unw_mean_f)
                        {
                            fm_order.splice(fo, 0, fm[xf]);
                            break;
                        }
                        else fo++;
                    }
                    if(fo==fm_order.length) fm_order.push(fm[xf]);
                }
                //if(fm_len > fm_max_len) fm_max_len = fm_len;
                //if(fm_enr > fm_max_enr) fm_max_enr = fm_enr;
            }
        }
    }
    return fm_order;
}


export function clear_fm()
{
    fm = null;
    fm = [];
    fm_noise_residue = 0;
    fm_voiced_energy = 0;
}



export function accumulate_fm(bins, peaks, ci, ci_energy, local_minimum)    //accumulate peaks and create formants
{
    
    let total_peaks = peaks.length;
    if(total_peaks<1) return;
    let pk_fm = new Array(total_peaks).fill(-1);
    let pk_score = new Array(total_peaks).fill(0);
    fm_noise_residue += ci_energy;
    
    //match peaks with the ongoing formants
    for(let k=0; k<fm.length; k++)
    {
        let cid = ci - fm[k][ci_en];
        
        if((cid >= 0) && (cid < ci_max_dist))
        {
            let fm_len =  fm[k][7].length;
            for(let p=0; p<total_peaks; p++)
            {
                let cfd = Math.abs(fm[k][5] - peaks[p][2]);
                if(cfd < cf_lim[cid])
                {
                                    // get_match_index(cid, cfd, fm_len, f1, f2, a1, a2, last_slp)
                    let this_score = get_match_index(cid, cfd, fm_len, fm[k][5], peaks[p][2], fm[k][6], bins[peaks[p][2]], fm[k][ci_slp]);
                    if((this_score > 1) && (this_score > pk_score[p]))
                    {
                        pk_score[p] =  this_score;
                        pk_fm[p] = k;
                    }
                }
            }
        }
    }

    for(let k=0; k<fm.length; k++)
    {
        let fm_ps = [];
        for(let p=0; p<total_peaks; p++) if( pk_fm[p]==k) { fm_ps.push(p) };    //make a list of peaks that belong to this fm
        if(fm_ps.length>0)
        {
            let pk_max = peaks[fm_ps[0]][2];
            let pk_amp = bins[pk_max];
            if(pk_amp > local_minimum)
            {
                
                let pk_st = peaks[fm_ps[0]][cf_st];
                let pk_en = peaks[fm_ps[0]][cf_en];

                for(let ps=0; ps<fm_ps.length;ps++) //aggregate multiple peaks that belong to the same fm but at the same concurrent ci
                {
                    if(peaks[fm_ps[ps]][cf_en] > pk_en) pk_en = peaks[fm_ps[ps]][cf_en];    //cf upper end
                    if(peaks[fm_ps[ps]][cf_st] < pk_st) pk_st = peaks[fm_ps[ps]][cf_st];    //cf lower end
                    if(bins[peaks[fm_ps[ps]][2]] > bins[pk_max]) pk_max = peaks[fm_ps[ps]][2];  //cf peak with the max amp
                }
                let pk_energy = 0;
                for(let cf=pk_st; cf<=pk_en; cf++) pk_energy += bins[cf];
                pk_energy = pk_energy;
                //recent average slope of the formant
                let n_peaks = fm[k][10].length;
                if(n_peaks >= 3)
                {
                    fm[k][ci_slp] = ((pk_max - fm[k][10][n_peaks-1]) + (fm[k][10][n_peaks-2] - fm[k][10][n_peaks-1])  + (fm[k][10][n_peaks-3] - fm[k][10][n_peaks-2]))/3;
                }
                else if(n_peaks == 2)
                {
                    fm[k][ci_slp] = ((pk_max - fm[k][10][n_peaks - 1]) + (fm[k][10][n_peaks - 2] - fm[k][10][n_peaks - 1])  ) / 2;
                }
                else if(n_peaks == 1)
                {
                    fm[k][ci_slp] = pk_max - fm[k][10][n_peaks - 1];
                }
                

                fm[k][cf_st] = pk_st;   //last up valley cf
                fm[k][cf_en] = pk_en;   //last dn valley cf
                fm[k][ci_st] = ci;  //start ci
                fm[k][ci_en] = ci;  //last ci
                //fm[k][ci_slp] = 0;  //last dir
                fm[k][5] = pk_max;       //last peak cf
                fm[k][6] = pk_amp; //last peak amp
                
                fm[k][7].push(ci);   //list of ci, it can go over seg_size or seg_len in case of noise at the end
                fm[k][8].push(pk_st); //list up valley cf
                fm[k][9].push(pk_en); //list dn valley cf
                fm[k][10].push(pk_max); //list of peak f
                fm[k][11].push( pk_amp); //list of peak amp
                fm[k][12].push( pk_energy); //list of energy

                fm[k][13] += pk_energy;
                fm[k][14] += 1;
                fm[k][15] += pk_energy * pk_max;  //for unweighted mean frequency
                fm[k][16] = 0;    //formant rank, decided later
                fm[k][17] += pk_en - pk_st + 1;    //formant span, for averaging
                fm_noise_residue -= pk_energy;
                fm_voiced_energy += pk_energy;
            }
        }
    }

    for(let p=0; p<total_peaks; p++)
    {
        if(pk_fm[p]==-1)
        {
            let pk_max = peaks[p][2];
            let pk_amp = bins[pk_max];
            if(pk_amp > local_minimum)
            {
                let pk_st = peaks[p][cf_st];
                let pk_en = peaks[p][cf_en];
                let pk_energy = 0;
                for(let cf=pk_st; cf<=pk_en; cf++) pk_energy += bins[cf];
                pk_energy = pk_energy;

                let new_fm = [];
                new_fm[cf_st] = pk_st;   //last up valley cf
                new_fm[cf_en] = pk_en;   //last dn valley cf
                new_fm[ci_st] = ci;  //start ci
                new_fm[ci_en] = ci;  //last ci
                new_fm[ci_slp] = 0;  //last dir
                new_fm[5] = pk_max;       //last peak cf
                new_fm[6] = pk_amp; //last peak amp
                
                new_fm[7] = [ci];   //list of ci, it can go over seg_size or seg_len in case of noise at the end
                new_fm[8] = [pk_st]; //list up valley cf
                new_fm[9] = [pk_en]; //list dn valley cf
                new_fm[10] = [pk_max]; //list of peak f
                new_fm[11] = [pk_amp]; //list of peak amp
                new_fm[12] = [pk_energy]; //list of energy
                
                new_fm[13] = pk_energy; //sum energy
                new_fm[14] = 1; //sum length
                new_fm[15] = pk_energy * pk_max;    //for unweighted mean frequency
                new_fm[16] = 0;    //formant rank
                new_fm[17] = pk_en - pk_st + 1;    //formant span, for averaging

                fm.push(new_fm);    //start a new formant
            }
        }
    }
   
}

function get_match_index(cid, cfd, fm_len, f1, f2, a1, a2, last_slp)
{
    //create a single quantity that is used to compare the matching of a new frame to a formant in buffer
    let amx = 0;
    if (a1>=a2) amx = a2/a1;
    else if (a2>0) amx = a1/a2;
    else return 0;  //a2=0

    if(cid==0)// && (cfd<cf_lim[cid])) // time stamp difference is 0
    {
        //match amps
        if(amx > 0.1) return amx*300/cfd;
        else return 0;
    }
    else    // a gap between time stamps
    {
        //amx: 10 to 1
        if(amx < 0.001) return 0;
        else if(amx >= 1) amx = 10;
        else if(amx < 0.1) amx = 1;
        else amx = 10*amx;

        //slx: 10 to 1, slope index
        let slx = 10 - Math.abs((f2-f1) - last_slp);
        if(slx < 0) return 0;
        else if(slx < 1) slx = 1;

        //fnx: 10 to 1
        let lnx = fm_len;
        if(lnx > 10) lnx = 10;

        return (10/cid) * ((slx*slx) + (lnx*amx));
    }
}

