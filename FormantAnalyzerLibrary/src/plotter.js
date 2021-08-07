
const stats = require('./stats.js');    //uses solve_poly() to display fitted curves

let SpecCtx = null;//document.querySelector('#SpectrumCanvas').getContext('2d');

let SPEC_BOX_WIDTH = 800;
let SPEC_BOX_HEIGHT = 400;
let X_LENGTH = 256;
let Y_LENGTH = 64;
let PIXEL_WIDTH = SPEC_BOX_WIDTH/X_LENGTH;
let PIXEL_HEIGHT = SPEC_BOX_HEIGHT/Y_LENGTH;
let call_counter = 0;

export function init_canvas(spectrum_canvas_object, canvas_width=800, canvas_height=400, x_length=256, y_length=64)
{
    //pass: const spectrum_canvas_object = document.querySelector('#SpectrumCanvas').getContext('2d');
    // where 'SpectrumCanvas' is the id of HTML element <canvas id="SpectrumCanvas" width="900" height="400" ></canvas>

    if(spectrum_canvas_object)
    {
        SPEC_BOX_WIDTH = canvas_width;
        SPEC_BOX_HEIGHT = canvas_height;
        X_LENGTH = x_length;
        Y_LENGTH = y_length;
        PIXEL_WIDTH = (SPEC_BOX_WIDTH - 35)/x_length;
        PIXEL_HEIGHT =  SPEC_BOX_HEIGHT/y_length;
        SpecCtx = spectrum_canvas_object;
        SpecCtx.fillStyle = 'rgb(10, 10, 20)';
        SpecCtx.fillRect(0, 0, SPEC_BOX_WIDTH, SPEC_BOX_HEIGHT);

        SpecCtx.font = "30px Trebuchet MS";
        SpecCtx.fillStyle = "gray";
        SpecCtx.textAlign = "center";
        SpecCtx.fillText("^_^", (SPEC_BOX_WIDTH/2) - 15, 100);
        call_counter = 0;
        return true;
    }
    return false;
}


export function clear_plot(blank=true)
{
    if(SpecCtx)
    {
        call_counter++;
        if(blank) SpecCtx.clearRect(0, 0, SPEC_BOX_WIDTH, SPEC_BOX_HEIGHT);
        return true;
    }
    return false;
}

export async function plot_raw_segment(pfm, seg_size, seg_t0_tlen, left_indent, norm_max)
{
    if(!SpecCtx) return false;    //not initialized, call init_canvas()
    
    let call_id = call_counter;
    for(let xf = 0; xf < pfm.length; xf++ )
    {
        if(call_id!=call_counter) return true;  //abandon it if a newer call is made for plotting 
        for(let cx = 0; cx < pfm[xf][14]; cx++ )
        {
            let ci = pfm[xf][7][cx];
            let lf = pfm[xf][8][cx];
            let hf = pfm[xf][9][cx];
            let mf = pfm[xf][10][cx];
            let amp = pfm[xf][11][cx] * 510 / norm_max;
            //let span_width = hf - lf;
            let span_amp = pfm[xf][12][cx] * 40/ norm_max;    //energy normalized

            let x_point = (left_indent + ci) * PIXEL_WIDTH;

            SpecCtx.fillStyle = 'rgb(' + (span_amp) + ',' + span_amp/2 + ',' + span_amp/4 + ')';
            for(let span = lf; span < mf; span++)
            {
                SpecCtx.fillRect(x_point, (Y_LENGTH - span - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
            }
            for(let span = mf+1; span <= hf; span++)
            {
                SpecCtx.fillRect(x_point, (Y_LENGTH - span - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
            }

            SpecCtx.fillStyle = 'rgb(' + amp/6 + ',' + amp/1.5 + ',' + amp + ')';
            SpecCtx.fillRect(x_point, (Y_LENGTH - mf - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
            
        }
    }
    
    if(call_id!=call_counter) return true;  //abandon it if a newer call is made for plotting 
    
    let end_point = (left_indent + seg_size) * PIXEL_WIDTH
    
    SpecCtx.font = "10px verdana";
    SpecCtx.textAlign = "left";
    SpecCtx.fillStyle = '#00ff00';
    SpecCtx.fillText(seg_t0_tlen[0].toFixed(2) , ((1+left_indent) * PIXEL_WIDTH), 20);
    SpecCtx.fillRect(left_indent * PIXEL_WIDTH, 0, 2, SPEC_BOX_HEIGHT);
    SpecCtx.textAlign = "right";
    SpecCtx.fillStyle = '#ff0000';
    SpecCtx.fillText((seg_t0_tlen[0] + seg_t0_tlen[1]).toFixed(2) , end_point - PIXEL_WIDTH, 40);
    SpecCtx.fillRect(end_point, 0, 2, SPEC_BOX_HEIGHT);
    return true;
}

export async function plot_axis_majors(bin_Hz, skl)
{
    if(!SpecCtx) return false;
    
    SpecCtx.font = "10px verdana";
    SpecCtx.textAlign = "left";
    SpecCtx.fillStyle = '#ffffff';
    SpecCtx.fillText("Hz", SPEC_BOX_WIDTH - 45, 15); 
    for(let j = 0; j < Y_LENGTH; j++ ) 
    {
        if((j%skl)==0)
        {
            SpecCtx.fillText(bin_Hz[j], SPEC_BOX_WIDTH - 30, ((Y_LENGTH -j - 1) * PIXEL_HEIGHT)  + 5); 
        }
    }
    return true;
}


export async function plot_syllable_anchors(si, syl_ci, left_indent, coeffs=null)
{
    if(!SpecCtx) return false;

    //console.log(syl_ci);
    SpecCtx.font = "10px verdana";
    SpecCtx.textAlign = "left";
    
    const n_co_start_i = 0;
    const n_co_ea = 5;
    const n_co_f0 = 4;
    
    for(let syl = 0; syl < syl_ci.length; syl++ ) 
    {
        let ci_start = syl_ci[syl][0];
        let ci_dist = syl_ci[syl][1]+1;
        //console.log(si + '\t' +ci_start +'\t' + ci_dist);
        SpecCtx.fillStyle = '#ffffff';
        SpecCtx.fillText(si+","+syl, PIXEL_WIDTH*(left_indent + ci_start), SPEC_BOX_HEIGHT - 6);
        SpecCtx.fillRect(PIXEL_WIDTH*(left_indent + ci_start), SPEC_BOX_HEIGHT - 3, PIXEL_WIDTH*ci_dist, 3);
        
        if(coeffs)
        {
            const coeffs_ea = coeffs[syl].slice(n_co_start_i, n_co_start_i+n_co_ea);
            const coeffs_f0 = coeffs[syl].slice(n_co_start_i+n_co_ea+2, n_co_start_i+n_co_ea+2+n_co_f0);
            //const coeffs_f1 = coeffs[syl].slice(12, 16);
            //const coeffs_f2 = coeffs[syl].slice(18, 20);
            SpecCtx.fillStyle = 'rgb(100, 100, 100)';
            //console.log(coeffs_ea.length + '\t' + coeffs_f0.length);

            /*
            let fit_coeffs_ea = cubic_curve_fit(syls_buff[2][bi], 1, 4, true);   //ener all, 0-6
            let fit_coeffs_f0 = cubic_curve_fit(syls_buff[1][bi], 0, 3);    //freq 0, 7-12
            let fit_coeffs_f1 = cubic_curve_fit(syls_buff[1][bi], 3, 3);  //freq 1
            let fit_coeffs_f2 = cubic_curve_fit(syls_buff[1][bi], 6, 1);  //freq 2
            */
            
            for (let ci=ci_start; ci<ci_start+ci_dist;ci++)
            {
                let y_val_ea =  stats.solve_poly(coeffs_ea, ci-ci_start);   //energy composite
                let y_val_f0 = stats.solve_poly(coeffs_f0, ci-ci_start);   //f0
                //let y_val_f1 = stats.solve_poly(coeffs_f1, ci-ci_start);   //f1
                //let y_val_f2 = stats.solve_poly(coeffs_f2, ci-ci_start);   //f2
                let x_point = (left_indent + ci) * PIXEL_WIDTH;
                SpecCtx.fillRect(x_point, (Y_LENGTH - y_val_ea - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
                SpecCtx.fillRect(x_point, (Y_LENGTH - y_val_f0 - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
                //SpecCtx.fillRect(x_point, (Y_LENGTH - y_val_f2 - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
            }
        }
        
    }
    
    return true;
}



export async function plot_formants(ci_fm_val, seg_size, seg_t0_tlen, left_indent, norm_max)
{
    if(!SpecCtx) return false;
    let call_id = call_counter;

    const fm_features_count = 3;
    const max_fm = parseInt(ci_fm_val[0].length/fm_features_count);
    
    for (let ci = 0; ci < seg_size; ci++)
    {
        if(call_id!=call_counter) return true;  //abandon it if a newer call is made for plotting

        
        for (let fr = 0; fr < max_fm; fr++)
        {
            let freq = ci_fm_val[ci][fr*fm_features_count];
            if(freq > 0)
            {
                let ener = ci_fm_val[ci][(fr*fm_features_count)+1] * 20 / norm_max;
                
                
                //Math.pow(10, ci_fm_val[ci][(fr*fm_features_count)+1]/200) * 20 / norm_max;
                let span = parseInt(ci_fm_val[ci][(fr*fm_features_count)+2] / 2);

                let x_point = (left_indent + ci) * PIXEL_WIDTH;
                SpecCtx.fillStyle = 'rgb(' + (ener) + ',' + ener/2 + ',' + ener/4 + ')';
                for(let low_side = freq - span; low_side < freq; low_side++)
                {
                    SpecCtx.fillRect(x_point, (Y_LENGTH - low_side - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
                }
                for(let high_side = freq+1; high_side <= freq + span; high_side++)
                {
                    SpecCtx.fillRect(x_point, (Y_LENGTH - high_side - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
                }
                //different colors for different formants
                if(fr==0) SpecCtx.fillStyle = 'rgb(0, 255, 50)';
                else if(fr==1) SpecCtx.fillStyle = 'rgb(255, 1, 255)';
                else if(fr==2) SpecCtx.fillStyle = 'rgb(10, 150, 255)';
                else if(fr==3) SpecCtx.fillStyle = 'rgb(248, 81, 67)';
                else if(fr==4) SpecCtx.fillStyle = 'rgb(177, 28, 67)';
                else SpecCtx.fillStyle = 'rgb(92, 14, 249)';
                SpecCtx.fillRect(x_point, (Y_LENGTH - freq - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT);
                
            }
        }
    }
    
    if(call_id!=call_counter) return true;  //abandon it if a newer call is made for plotting

    let end_point = (left_indent + seg_size) * PIXEL_WIDTH;
    
    
    SpecCtx.font = "10px verdana";
    SpecCtx.textAlign = "left";
    SpecCtx.fillStyle = '#ffffff';
    SpecCtx.fillText(seg_t0_tlen[0].toFixed(2), ((1+left_indent) * PIXEL_WIDTH), 20);
    SpecCtx.fillRect(left_indent * PIXEL_WIDTH, 0, 2, SPEC_BOX_HEIGHT);
    SpecCtx.textAlign = "right";
    SpecCtx.fillStyle = '#ff3d3d';
    SpecCtx.fillText((seg_t0_tlen[0] + seg_t0_tlen[1]).toFixed(2) , end_point - PIXEL_WIDTH, 40);
    SpecCtx.fillRect(end_point, 0, 2, SPEC_BOX_HEIGHT);
    
    return true;
}



export async function plot_segment_labels(seg_size, left_indent, segment_label)
{
    
    
    if((segment_label)&& (segment_label[1]) && (segment_label[1][0]) )
    {
        let end_point = (left_indent + seg_size) * PIXEL_WIDTH;
        let label_height = segment_label[1][1] * SPEC_BOX_HEIGHT;
        SpecCtx.font = "16px verdana";
        SpecCtx.fillStyle = "#1fff1f";
        SpecCtx.textAlign = "right";
        SpecCtx.fillText(segment_label[1][0], end_point - PIXEL_WIDTH, 100); 
        SpecCtx.fillRect(end_point, SPEC_BOX_HEIGHT - label_height, 2, label_height);
    }
}


export async function plot_spectrum(spectrum_data, norm_max) 
{
    if(!SpecCtx) return false;

    let call_id = call_counter;

    
    //set time out for each frame to avoid jitters
                
    for(let i = spectrum_data.length-1; i>=0; i--) 
    {
        window.setTimeout(function() {
            slow_spectrum(i, spectrum_data[i], norm_max);
        }, spectrum_data.length - i);

        if(call_id!=call_counter) return true;  //abandon it if a newer call is made for plotting
    }
    return true;
    

}

function slow_spectrum(i, bins, norm_max) //this function is called with a timeout to avoid overloading
{
      
    const log_enable = false;
    SpecCtx.clearRect(i * PIXEL_WIDTH, 0, PIXEL_WIDTH, SPEC_BOX_HEIGHT);
    for(let j = 0; j < Y_LENGTH; j++ ) 
    {
        let clr = bins[j] / norm_max;
        let R = clr; let G = clr; let B = clr;
        if ( clr > 0.01 )
        {
            
            if(log_enable)
            {
                if(clr > 0.9)
                {
                    R *= 50; G *= 255; B *= 510;
                }
                else if(clr > 0.8)
                {
                    R = 255 * clr; G = 255 * clr; B = 125 * clr;
                }
                else if(clr > 0.7)
                {
                    R = 255 * clr; G = 255 * clr; B = 255 * clr;
                }
                else if(clr > 0.5)
                {
                    R = 255 * clr; G = 200 * clr; B = 125 * clr;
                }
            }
            else
            {
                
                if(clr < 0.1)
                {
                    R = 2550 * clr; G = 100 * clr; B = 0;
                }
                else if(clr < 0.2)
                {
                    R = 2550 * clr; G = 1000 * clr; B = 100 * clr;
                }
                else if(clr < 0.5)
                {
                    R = 2550 * clr; G = 1250 * clr; B = 500 * clr;
                }
                else
                {
                    R = 50 * clr; G = 255 * clr; B = 255;
                }
            }
            SpecCtx.fillStyle = 'rgb(' + (R) + ',' + (G) + ',' + (B) + ')';
            SpecCtx.fillRect(i * PIXEL_WIDTH, (Y_LENGTH -j - 1) * PIXEL_HEIGHT, PIXEL_WIDTH, PIXEL_HEIGHT); 
        }
    }
}


export async function plotBands(band_amps, norm_max, bin_Hz, skl)
{
    if(!SpecCtx) return false;

    let call_id = call_counter;
    let barWidth = (SPEC_BOX_WIDTH / Y_LENGTH);
    let barHeight;
    var x = 0;


    for(var i = 0; i < Y_LENGTH; i++)
    {
        if(call_id!=call_counter) return true;  //abandon it if a newer call is made for plotting
        let clr = band_amps[i]/norm_max;
        
        let R = 255 * clr;
        let G = 50;
        let B = 50;
        barHeight = SPEC_BOX_HEIGHT*band_amps[i]/(norm_max*10);
        SpecCtx.fillStyle = 'rgb(' + (R) + ',' + (G) + ',' + (B) + ')';
        SpecCtx.fillRect(x,SPEC_BOX_HEIGHT-barHeight,barWidth,barHeight);

        x += barWidth;
        
    }
    
    if(bin_Hz.length>0)
    {   
        x = 0;
        SpecCtx.font = "10px verdana";
        SpecCtx.fillStyle = "white";
        SpecCtx.textAlign = "right";
        SpecCtx.fillText("Hz", SPEC_BOX_WIDTH/2, 40); 
        let ytc85=1;
        for(let j = 0; j < Y_LENGTH; j++ ) 
        {
            if((j%skl)==0)
            {
                SpecCtx.fillText(bin_Hz[j], x, (10+((ytc85%3)*10)));
                ytc85++;
            }
            x += barWidth;
        }
    }
    return true;
}


/*
window.requestAnimFrame = (function(){
    return  window.requestAnimationFrame       ||
            window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame    ||
            function(callback, element){
                window.setTimeout(callback, 10);
            };
    })();
*/