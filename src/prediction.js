
const nn_mod = require('./neuralmodel.js');
const plotly_lib = require('plotly.js-finance-dist-min');
//https://github.com/plotly/plotly.js/blob/master/dist/README.md#partial-bundles

//const label_type = "cats";
//const label_name = "emotion";

var sum_weights = 0;
var seg_weight = 0;

const available_DBs = [1];   //list the trained models available in dist/nnmodel. Name the directory as '1' for model 1
                            //For each DB, there are subdirs of label prediction models named as 'cats_labelname' or 'ords_labelhead'
                            //prediction mod will predict labels using all the model in all DB dirs, then report the one with min entropy
const DBs_N = available_DBs.length;
var min_entropy_db = null;
var max_inv_entropy = 0;
var DB_entropies_all = [];
var DB_entropies_seg = [];

var Label_conf_all = [];
var Label_conf_seg = [];

export function reset_predictions(all=true)
{
    
    if(all)
    {
        sum_weights = 0;
        for (let dbx=0; dbx<DBs_N; dbx++)
        {
            Label_conf_all[available_DBs[dbx]] = {};
            DB_entropies_all[available_DBs[dbx]] = 0;
        }
        max_inv_entropy = 0;
        
    }

    seg_weight = 0;
    for (let dbx=0; dbx<DBs_N; dbx++)
    {
        Label_conf_seg[available_DBs[dbx]] = {};
        DB_entropies_seg[available_DBs[dbx]] = 0;
    }
}

export function predict_by_multiple_syllables(predict_type, predict_label, si, incoming, seg_time, callback_after_pred=null)
{
    //predicts labels for all syllables in segment
    //then sums up the confidence to get the label of the max confidence as the segment label
    //let t0 = performance.now();
    reset_predictions(false);
    let pred_promises = [];
    
    for(let ph = 0; ph < seg_time.length; ph++ ) seg_weight += parseFloat(seg_time[ph][1]);

    
    if(seg_weight > 0)
    {
        for(let dbx = 0; dbx < DBs_N; dbx++ )
        {
            pred_promises.push(nn_prediction(available_DBs[dbx], incoming, seg_time, predict_type, predict_label));
        }

        Promise.all(pred_promises).then(function(){
            
            sum_weights += seg_weight;
            let segment_top_label_n_conf = seg_confidence_sort();

            if(callback_after_pred) callback_after_pred(si, segment_top_label_n_conf);  //send back to index
            
            if(predict_type=="cats") plot_prediction_meters();
            
            //console.log((performance.now() - t0) + " ms after B.");
        }).catch((err)=>{
            document.getElementById('msg').textContent = "Prediction error: " + err;
            console.error(err);
        });
    }

}




function nn_prediction(tdb_id, incoming, seg_time, predict_type, predict_label)
{
    return new Promise((resolve, reject)=>{
        function call_back_x4(result_out)
        {
            for(let ph = 0; ph < seg_time.length; ph++ )
            {
                let ph_weight = parseFloat(seg_time[ph][1]); //duration in seconds
                if(seg_time.length==1)
                {
                    let wconf = result_out[ph].confidence * ph_weight;
                    if(!Label_conf_all[tdb_id][result_out[ph].label]) Label_conf_all[tdb_id][result_out[ph].label] = wconf;
                    else Label_conf_all[tdb_id][result_out[ph].label] += wconf;

                    if(!Label_conf_seg[tdb_id][result_out[ph].label]) Label_conf_seg[tdb_id][result_out[ph].label] = wconf;
                    else Label_conf_seg[tdb_id][result_out[ph].label] += wconf;
                }
                else
                {
                    for (let pl=0; pl<result_out[ph].length; pl++)
                    {
                        let wconf = result_out[ph][pl].confidence * ph_weight;
                        if(!Label_conf_all[tdb_id][result_out[ph][pl].label]) Label_conf_all[tdb_id][result_out[ph][pl].label] = wconf;
                        else Label_conf_all[tdb_id][result_out[ph][pl].label] += wconf;

                        if(!Label_conf_seg[tdb_id][result_out[ph][pl].label]) Label_conf_seg[tdb_id][result_out[ph][pl].label] = wconf;
                        else Label_conf_seg[tdb_id][result_out[ph][pl].label] += wconf;
                    }
                }
            }
            
            resolve(1);
        };
        
        nn_mod.predict_single(tdb_id, incoming, call_back_x4, predict_type, predict_label);  //call nn classify
        
    });
}



function seg_confidence_sort()
{
    let max_conf_db_seg = 0;    //max confidence at seg level
    let top_lbl_db_seg = null;  //label with highest confidence at seg level
    for(let dbx = 0; dbx < DBs_N; dbx++ )
    {
        const db_id = available_DBs[dbx];
        const labels_h = Object.keys(Label_conf_all[db_id]);
        
        let max_c_all = 0;
        let max_c_seg = 0;
        let max_lbh_seg = null;

        for (let pl=0; pl<labels_h.length; pl++)
        {
            if(Label_conf_all[db_id][labels_h[pl]] > max_c_all)
            {
                max_c_all = Label_conf_all[db_id][labels_h[pl]];
            }
            if(Label_conf_seg[db_id][labels_h[pl]] > max_c_seg)
            {
                max_c_seg = Label_conf_seg[db_id][labels_h[pl]];
                max_lbh_seg = labels_h[pl];
            }
        }
        
        DB_entropies_all[db_id] = max_c_all;
        DB_entropies_seg[db_id] = max_c_seg;

        if(DB_entropies_seg[db_id] > max_conf_db_seg)
        {
            max_conf_db_seg = DB_entropies_seg[db_id];
            top_lbl_db_seg = max_lbh_seg;
        }
        if(DB_entropies_all[db_id] > max_inv_entropy)
        {
            max_inv_entropy = DB_entropies_all[db_id];
            min_entropy_db = db_id;
        }
    }
    
    return [top_lbl_db_seg, max_conf_db_seg/seg_weight];
}


function plot_prediction_meters()
{
    if(min_entropy_db!=null)
    {
        const db_id = min_entropy_db;
        if(Label_conf_all[db_id])
        {

            const labels_h = Object.keys(Label_conf_all[db_id]);
            document.getElementById('speedometers_div').innerHTML = "";
            let all_class_sum = 0;
            for (let pl=0; pl<labels_h.length; pl++)
                all_class_sum += Label_conf_all[db_id][labels_h[pl]];
            
            for (let pl=0; pl<labels_h.length; pl++)
            {
                var gauge_data = [
                {
                        domain: { x: [0, 1], y: [0, 1] },
                        value: Label_conf_all[db_id][labels_h[pl]]/all_class_sum,
                        title: { text: labels_h[pl] },
                        type: "indicator",
                        
                        mode: "gauge",
                        gauge: {
                            axis: { range: [0, 1] },
                            bgcolor: "black"
                        },
                    }
                ];
                
                const gauge_layout = { width: 250, height: 200, margin: { t: 0, b: 0 }, paper_bgcolor: "black", font: { color: "yellow"}};
                document.getElementById('speedometers_div').innerHTML += `<div id="meter_${labels_h[pl]}" class="w3-cell" style="width:250px;  display: inline-block;"></div>`;
                plotly_lib.newPlot('meter_' + labels_h[pl], gauge_data, gauge_layout);
            }
            let entropy_now = (1-(DB_entropies_all[db_id]/all_class_sum));
            if(entropy_now>0.5)
            document.getElementById('speedometers_div').innerHTML += `<span style="color:red;"><b>Entropy: ${entropy_now.toFixed(3)}</b></span>`;
            else
            document.getElementById('speedometers_div').innerHTML += `<span><small>Entropy: ${entropy_now.toFixed(3)}</small></span>`;
            document.getElementById('speedometers_div').style.display = 'block';
        }
    }
}


