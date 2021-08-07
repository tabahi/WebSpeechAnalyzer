
const stats = require('./stats.js');

const max_voiced_bin = parseInt(80/2); //set same as in segmentor.js

export function get_utterance_features(segments_ci, syllables)
{
    //new: add normalized array return
    //new: add word level pauses
    
    try{

    const total_words = syllables.length;
    if(segments_ci.length !=total_words ) console.error("Array sizes mismatch");
    
    if(total_words>0)
    {
        reset_bins();

        let last_word_t_end = segments_ci[0][0];    //init with the start point, so that pre-pause size for first word is 0
       
        
        for (let w=0; w<total_words; w++)
        {
            const word_length = segments_ci[w][1];
            const syls_count = syllables[w][0].length;


            let sum_syls_length = 0;
            for (let s=0; s<syls_count; s++)
            {
                const syl_length = syllables[w][0][s][1];
                let f0_mean = 0;
                let f0_ener = 0;
                let f0_span = 0;
                let f0_diff = 0;
                let voiced_f0_n = 0;
                let f1_mean = 0;
                let f1_ener = 0;
                let f1_span = 0;
                let f1_diff = 0;
                let voiced_f1_n = 0;
                for (let ci=0; ci<syl_length; ci++)
                {
                    if(syllables[w][1][s][ci][0] > 0)
                    {
                        voiced_f0_n++;
                        f0_mean += syllables[w][1][s][ci][0];
                        f0_ener += syllables[w][1][s][ci][1];
                        f0_span += syllables[w][1][s][ci][2];
                        if(ci > 0)
                        {
                            f0_diff += syllables[w][1][s][ci][0] - syllables[w][1][s][ci-1][0];
                        }
                    }
                    if(syllables[w][1][s][ci][3] > 0)
                    {
                        voiced_f1_n++;
                        f1_mean += syllables[w][1][s][ci][3];
                        f1_ener += syllables[w][1][s][ci][4];
                        f1_span += syllables[w][1][s][ci][5];
                        if(ci > 0)
                        {
                            f1_diff += syllables[w][1][s][ci][3] - syllables[w][1][s][ci-1][3];
                        }
                    }
                }
                f0_mean /= voiced_f0_n;
                f0_ener /= voiced_f0_n;
                f0_span /= voiced_f0_n;
                f1_mean /= voiced_f1_n;
                f1_ener /= voiced_f1_n;
                f1_span /= voiced_f1_n;

                accumulate_syls(syl_length, f0_mean, f0_ener, f0_span, f0_diff, voiced_f0_n, f1_mean, f1_ener, f1_span, f1_diff, voiced_f1_n);


                sum_syls_length += syl_length;
            }

            accumulate_words(word_length, syls_count, segments_ci[w][0] - last_word_t_end, sum_syls_length/word_length);
            last_word_t_end = segments_ci[w][0] + segments_ci[w][1];

        }
        
        return get_normal_row();
    }

} catch(e){console.error(e);}
    return null;

}

const max_ws = 10;

var wlen_data, syl_counts_data, pre_pause_data, word_emptiness_data;

function accumulate_words(word_len, syl_counts, pre_pause, word_emptiness)
{
    //console.log(word_len + '\t' + syl_counts + '\t' + pre_pause + '\t' + word_emptiness);
    let word_len_x = parseInt(word_len*max_ws/150);
    if(word_len_x >= max_ws) word_len_x = max_ws - 1;
    wlen_data[word_len_x]++;

    let syl_counts_x = syl_counts;
    if(syl_counts_x >= max_ws) syl_counts_x = max_ws - 1;
    syl_counts_data[syl_counts_x]++;

    let pre_pause_x = parseInt(pre_pause*max_ws/150);
    if(pre_pause_x >= max_ws) pre_pause_x = max_ws - 1;
    pre_pause_data[pre_pause_x]++;

    let word_emptiness_x = parseInt(((word_emptiness-0.3)*2)*max_ws);
    if(word_emptiness_x >= max_ws) word_emptiness_x = max_ws - 1;
    if(word_emptiness_x < 0) word_emptiness_x = 0;
    word_emptiness_data[word_emptiness_x]++;
}

const max_e = 24;
const max_s = 8;
const max_metal = 10;
const max_diff = 20;
const max_len = 20;

var len_data, f0_data, f1_data, e0_data, e1_data, s0_data, s1_data, m0_data, m1_data, d0_data, d1_data;

function accumulate_syls(syl_length, f0_mean, f0_ener, f0_span, f0_diff, voiced_f0_n, f1_mean, f1_ener, f1_span, f1_diff, voiced_f1_n)
{
    //console.log(f0_diff + '\t' + f1_diff);
    let syl_length_x = parseInt(syl_length/2);
    if(syl_length_x >= max_len) syl_length_x = max_len - 1;
    len_data[syl_length_x]++;

    let f0_x = parseInt(f0_mean/2);
    if(f0_x >= max_voiced_bin) f0_x = max_voiced_bin - 1;
    f0_data[f0_x]++;

    let f1_x = parseInt(f1_mean/2);
    if(f1_x >= max_voiced_bin) f1_x = max_voiced_bin - 1;
    f1_data[f1_x]++;
    
    
    let e0_x = parseInt(Math.log10(f0_ener)*3);
    
    if(e0_x >= max_e) e0_x = max_e - 1;
    e0_data[e0_x]++;

    let e1_x = parseInt(Math.log10(f1_ener)*4);
    
    if(e1_x >= max_e) e1_x = max_e - 1;
    e1_data[e1_x]++;
    
    let s0_x = parseInt(f0_span/2);
    
    if(s0_x >= max_s) s0_x = max_s - 1;
    s0_data[s0_x]++;

    let s1_x = parseInt(f1_span/2);
    if(s1_x >= max_s) s1_x = max_s - 1;
    s1_data[s1_x]++;

    let m0_x = parseInt((syl_length-voiced_f0_n)*max_metal/syl_length);
    if(m0_x >= max_metal) m0_x = max_metal - 1;
    m0_data[m0_x]++;

    let m1_x = parseInt((syl_length-voiced_f1_n)*max_metal/syl_length);
    if(m1_x >= max_metal) m1_x = max_metal - 1;
    m1_data[m1_x]++;

    let d0_x = parseInt((f0_diff + 50)*max_diff/100);
    
    if(d0_x >= max_diff) d0_x = max_diff - 1;
    if(d0_x < 0) d0_x = 0;
    d0_data[d0_x]++;

    let d1_x = parseInt((f1_diff + 50)*max_diff/100);
    if(d1_x >= max_diff) d1_x = max_diff - 1;
    if(d1_x < 0) d1_x = 0;
    d1_data[d1_x]++;
}


function get_normal_row()
{
    

    let row = [];
    function add_to_row(arr)
    {
        for(let i in arr) { row.push(arr[i]); }
    }
    
    add_to_row(array_normalize(wlen_data));
    add_to_row(array_normalize(syl_counts_data));
    add_to_row(array_normalize(pre_pause_data));
    add_to_row(array_normalize(word_emptiness_data));

    add_to_row(array_normalize(len_data));
    add_to_row(array_normalize(f0_data));
    add_to_row(array_normalize(f1_data));
    add_to_row(array_normalize(e0_data));
    add_to_row(array_normalize(e1_data));
    add_to_row(array_normalize(s0_data));
    add_to_row(array_normalize(s1_data));
    add_to_row(array_normalize(m0_data));
    add_to_row(array_normalize(m1_data));
    add_to_row(array_normalize(d0_data));
    add_to_row(array_normalize(d1_data));
    //console.log(row);
    return row;
}


function reset_bins()
{
    len_data = new Array(max_len).fill(0);
    f0_data = new Array(max_voiced_bin).fill(0);
    f1_data = new Array(max_voiced_bin).fill(0);
    e0_data = new Array(max_e).fill(0);
    e1_data = new Array(max_e).fill(0);
    s0_data = new Array(max_s).fill(0);
    s1_data = new Array(max_s).fill(0);
    m0_data = new Array(max_metal).fill(0);
    m1_data = new Array(max_metal).fill(0);
    d0_data = new Array(max_diff).fill(0);
    d1_data = new Array(max_diff).fill(0);

    
    wlen_data = new Array(max_ws).fill(0);
    syl_counts_data = new Array(max_ws).fill(0);
    pre_pause_data = new Array(max_ws).fill(0);
    word_emptiness_data = new Array(max_ws).fill(0);

}

function array_normalize(arr)
{
    let sum = 0;
    for(let i in arr) { sum += arr[i]; }
    
    let ret = arr.slice();
    
    if(sum>0)
    for(let x=0; x<ret.length; x++) { ret[x] /= sum; }
    return ret;
}
