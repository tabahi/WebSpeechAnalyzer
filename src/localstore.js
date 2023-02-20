
const labeling_mod = require('./labeling.js');
const sep_utt = true;   //separate utterances by silence


//const syl_seg_features_N = 53; //63
const process_exp_features_len = [0,1,2,3,4,53,0,0,0,0,9,264,23,53,14,15];
const ctx_features_en = false;

var label_heads_cat = [];
var label_heads_ord = [];


//let label_cats = ['X'];// auto detect when parse_DB_label==true, set to custom for only prediction mode
const parse_DB_label = true;    //uses filename to labels JSON files from emoisNaN(isNaN(_mod

//const empty_label = NaN; //any label of this value is considered unmarked or empty, it helps in masking
const key_addr_db = '_a_', key_ts = 'ts_', key_true = 'true_', key_pred = 'pred_';
//let labels_loaded = false;
/*
Steps:
1 - if_file_in_db: Check if file already stored in DB to decide if to update or to skip
2 - StoreFeatures: Send data to store or update features and time data (no labels)
3 - update_address_table: is called by StoreFeatures to create an index of stored data
4 - collect_db_data: returns the stored features data, labels data if stored otherwise returns the extracted from filename labels
5 - update_true_label and update_pred_label store the labels
*/
export function if_file_in_db(db_id, file_name) //seg_key
{
    let key_name = String(db_id) + '#' + file_name;    //filename
    if(sep_utt) key_name = key_name + '#' + String(0);
    
    let clip_features = window.localStorage.getItem(key_name);
    if(clip_features) return true;
    return false;
}


export function StoreFeatures(process_level, db_id, si, seg_key, seg_time, new_in) //seg_key, key_ts
{
    let this_seg_key= String(db_id) + '#' + seg_key[0];   //filename
    if(sep_utt) this_seg_key = this_seg_key + '#' + String(si);
    //console.log(this_seg_key);

    
    if(new_in.length != process_exp_features_len[process_level]) { console.error("Invalid feature length "+(new_in.length)+ "... :"+process_exp_features_len[process_level]);  return;}
    if(process_level<=4)
    {
        let ci_arr = [];
        for (let ci=0; ci<new_in.length; ci++) {ci_arr.push( Array.from (new_in[ci])); }
        ci_arr = JSON.stringify(ci_arr);
        
        window.localStorage.setItem(this_seg_key, ci_arr);
        window.localStorage.setItem(key_ts + this_seg_key, JSON.stringify(seg_time));
    }
    else
    {
        window.localStorage.setItem(this_seg_key, JSON.stringify(new_in));
        window.localStorage.setItem(key_ts + this_seg_key, JSON.stringify(seg_time));
    }
    update_address_table(db_id, this_seg_key);


    return;
}


function update_address_table(db_id, seg_key=null, seg_keys=null) //address_key
{
    //use seg_key for single segment, and seg_keys for multiple segments
    let address_key = key_addr_db + String(db_id);
    let _addresses = window.localStorage.getItem(address_key);
    
    if(!_addresses)  
        _addresses = [];    //create new addresses db
    else
        _addresses = JSON.parse(_addresses);

    if(seg_key)
    {
        const file_i = _addresses.indexOf(seg_key);

        if(file_i<0)
        {
            _addresses.push(seg_key);
            window.localStorage.setItem(address_key, JSON.stringify(_addresses));
        }
    }
    if(seg_keys)
    {
        for (let i=0; i<seg_keys.length; i++)
        {
            const file_i = _addresses.indexOf(seg_keys[i]);
            if(file_i<0) _addresses.push(seg_keys[i]);
        }
        
        window.localStorage.setItem(address_key, JSON.stringify(_addresses));
    }
    return;
}




export function collect_db_data(db_id) //address_key, seg_key, key_ts, key_true, key_pred
{
    //called from Refresh_Table, Download_DB_JSON, predict_db_nn, train_nn
    //returns everything except addrress table
    let address_key = key_addr_db + String(db_id);
    // console.log("Loading DB: " + (address_key));
    
    let _addresses = window.localStorage.getItem(address_key);
    if(_addresses)  
    {
        check_label_heads();
        let seg_key_collect = [];
        let timestamps_collect = [];
        let features_collect = [];
        let origin_labels_collect = [];
        let true_labels_collect = [];
        let pred_labels_collect = [];

        
        
        _addresses = JSON.parse(_addresses);    //seg key_name
        let last_filename = "";
        let cxt_features = null;

        for(let ix=0; ix<_addresses.length; ix++)
        {
            //start calc ctx features
            /*
            if(ctx_features_en)
            {
                let filename = _addresses[ix].split("#")[1];
                if(filename!=last_filename)
                {
                    cxt_features = [];
                    last_filename = filename;
                    for(let ixc=ix; ixc<_addresses.length; ixc++)
                    {
                        filename = _addresses[ixc].split("#")[1];
                        if((filename!=last_filename) || (ixc==_addresses.length-1))
                        {
                            const ctx_n = cxt_features.length;
                            let avg_arr = new Array(ctx_features_N).fill(0);
                            if(ctx_n>0)
                            {
                                for(let ctxi=0; ctxi<ctx_n; ctxi++)
                                for(let fxi=syl_features_N; fxi < syl_seg_features_N; fxi++)
                                avg_arr[fxi-syl_features_N] += cxt_features[ctxi][fxi];
                                for(let fxi=0; fxi<syl_features_N; fxi++)
                                avg_arr[fxi] /= ctx_n;
                                
                                cxt_features = null;
                                cxt_features = avg_arr;
                                avg_arr = null;
                            }
                            else cxt_features = avg_arr;
                            break;
                        }
                        else
                        {
                            let this_file_features = window.localStorage.getItem(_addresses[ix]);
                            if(this_file_features)
                            {
                                this_file_features = JSON.parse(this_file_features); //convert to array
                                cxt_features.push(this_file_features);
                            }
                        }
                    }
                }
            }*/
            //end ctx features
            
            let this_file_features = window.localStorage.getItem(_addresses[ix]);
            if(this_file_features)
            {
                //Get features and time from storage
                this_file_features = JSON.parse(this_file_features); //convert to array
                let seg_time = JSON.parse(window.localStorage.getItem(key_ts + _addresses[ix]));

                //Get labels from storage or a loaded DB index json file
                let this_true_obj = get_true_labels(_addresses[ix]);
                let this_origin_obj = this_true_obj[1];
                this_true_obj = this_true_obj[0];
                
                let this_pred_obj = get_pred_labels(_addresses[ix]);
                
                if(ctx_features_en)
                    this_file_features = [].concat(this_file_features, cxt_features);
                
                
                //push to all array. These arrays should be in sync
                seg_key_collect.push(_addresses[ix]);
                timestamps_collect.push(seg_time);
                features_collect.push(this_file_features);
                origin_labels_collect.push(this_origin_obj);
                true_labels_collect.push(this_true_obj);
                pred_labels_collect.push(this_pred_obj);
            }
            else
            {
                console.warn("Missing an indexed feature DB: " + _addresses[ix])
            }
        }
        
        return [seg_key_collect, timestamps_collect, features_collect, origin_labels_collect, true_labels_collect, pred_labels_collect];
    }
    else
    {
        console.warn("No data in DB");
        return null;
    }
    
}


//check_label_heads();


function check_label_heads()
{
    
    try
    {
        let xx43 = document.getElementById('class_labels').value;
        if(xx43) xx43 = JSON.parse(document.getElementById('class_labels').value);
        if(xx43!==null) { if (xx43.length==0) label_heads_cat = []; else label_heads_cat = xx43; }
        let xx44 = document.getElementById('ordinal_labels').value;
        if(xx44) xx44 = JSON.parse(xx44);
        if(xx44!==null) { if (xx44.length==0) label_heads_ord = []; else label_heads_ord = xx44;}
        /*
        for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
        {
            console.log(Object.keys(label_heads_cat[y_cat])[0]);
        }
        for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
        {
            console.log(label_heads_ord[y_ord]);
        }*/
        
    }
    catch(e)
    {
        alert(e);
    }
}


export function get_label_heads()
{
    check_label_heads();
    return [label_heads_cat, label_heads_ord];
}

var table_rows_i = 0;
var table_refresh_i = 0;

export async function Refresh_Table(db_id, enable_disable, view_page=0)
{
    if(enable_disable)
    {
        //update_true_label("1#0002_01_F_N_2.6666666666666665_2.6666666666666665_2.6666666666666665_.wav#0", 'K');
        check_label_heads(); 
        let data = collect_db_data(db_id);
        
        
        document.getElementById("table_div").innerHTML = "";
        let thtml = `<table id="table_0" class="center w3-table w3-bordered" style="table-layout: fixed;">
        <tr> <th style="width:30px;">#</th>
        <th style="width:70px;">File</th>
        <th style="width:30px;"><sub>Part</sub></th>
        <th style="width:30px;">N<sub>f</sub></th>
        <th style="width:30px;">t<sub>0</sub></th>
        <th style="width:30px;">t<sub>len</sub></th>
        <th style="width:20px;"><sub>Init</sub></th>`;

        
        for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
        {
            let this_label_head = Object.keys(label_heads_cat[y_cat])[0];
            if(this_label_head.length > 4) this_label_head = this_label_head.slice(0,3);
            thtml += `<th style="width:40px;"><i>${this_label_head}</i></th>`;
        }

        for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
        {
            let this_label_head = label_heads_ord[y_ord];
            if(this_label_head.length > 4) this_label_head = this_label_head.slice(0,3);
            thtml += `<th style="width:40px;"><i>${this_label_head}</i></th>`;
        }
        thtml += `<th style="width:30px;">Pred</th> </tr>`;
        document.getElementById("table_div").innerHTML = thtml;
        

        if(data)
        {
            table_rows_i = 1;
            table_refresh_i++;
            
            const count_N = data[0].length;
            let max_view_N = count_N;
            if(max_view_N>100) max_view_N = 100;

            let total_dur = 0; let max_len = 0;
            for (let i=0; i<count_N; i++) 
            {
                let t_durat = parseFloat(data[1][i][1]);
                if(t_durat > max_len) max_len = t_durat;
                total_dur += t_durat;
                if(i< max_view_N)
                {
                    let seg_key = data[0][i];
                    let addr = seg_key.split("#");
                    let filename = addr[1];
                    let seg_n = parseInt(addr[2])+1;
                    let N_f = data[2][i].length;
                    let t_start = parseFloat(data[1][i][0]).toFixed(2);
                    let init = ((data[3][i]) && (Object.keys(data[3][i]).length>0));
                    let true_labels = data[4][i];
                    let pred_labels = data[5][i];
                    const tbi=table_refresh_i;
                    setTimeout(function(){add_table_row(tbi, i+1, seg_key, filename, seg_n, N_f, t_start, t_durat.toFixed(2), init, true_labels, pred_labels);}, i*5 );
                }
            }
            
            document.getElementById("table_div").innerHTML += "<p>Viewing " + max_view_N +" / " + data[0].length + ", Total: " + (total_dur/60).toFixed(2) +  " mins, Avg: "+(total_dur/count_N).toFixed(2)  +  " s, Max: "+ (max_len).toFixed(2) + " s, Last: " +data[0][count_N-1] + "</p>";
        
            
            shows_stats_table(data);
            data = null;
            thtml = null;
            
        }
    }
    else
    {
        document.getElementById("table_div").innerHTML = "";
        document.getElementById("results_div").innerHTML = "";
    }
}



function add_table_row(tbi, seg_i, seg_key, filename, seg_n, N_f, t_start, t_durat, init, true_labels, pred_labels)
{
    if(tbi!=table_refresh_i) return;
    var table = document.getElementById("table_0");
    let thtml = "";
    let row = table.insertRow(table_rows_i);
    table_rows_i++;
    let cell_i = 0;
    
    //let t_start = parseFloat(data[1][i][0]).toFixed(2);
    //let t_durat = parseFloat(data[1][i][1]).toFixed(2);
    //let addr = data[0][i].split("#");

    
    let cell = row.insertCell(cell_i); cell_i++;
    cell.innerHTML = `${seg_i}`;   //index

    cell = row.insertCell(cell_i); cell_i++; //file name
    cell.innerHTML = `<button onclick="SA.play_file_sample('${filename}')" class='w3-button w3-tiny w3-border w3-round w3-padding-small'>${filename.substring(0, 15)}</button>`;


    cell = row.insertCell(cell_i); cell_i++;  //seg num
    cell.innerHTML = `<button onclick="SA.play_file_sample('${filename}',${t_start},${t_durat})" class='w3-button w3-tiny w3-border w3-round w3-padding-small'>${seg_n}</button>`; 

    
    cell = row.insertCell(cell_i); cell_i++;  //number of features
    cell.innerHTML = `${N_f}`;

    cell = row.insertCell(cell_i); cell_i++;
    cell.innerHTML = `${t_start}`;
    cell = row.insertCell(cell_i); cell_i++;
    cell.innerHTML = `${t_durat}`;


    cell = row.insertCell(cell_i); cell_i++; //original label
    if(init) cell.innerHTML = `${1}`;  //original label is parsed as true label
    else cell.innerHTML = `${0}`;  //original label not used


    
    
    
    let predicted_labels_n = 0;

    const radio_name = "r_" + seg_key + "_";

    
    //if(true_labels)
    for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++) //emotion, sex, etc
    {
        const label_ = Object.keys(label_heads_cat[y_cat])[0]
        let val = (true_labels && true_labels[0] && true_labels[0][label_]) ? true_labels[0][label_] : NaN;
        
        let recognized_index = label_heads_cat[y_cat][label_].indexOf(val);    //find index in the header

        if(val==null) val = NaN;
        
        cell = row.insertCell(cell_i); cell_i++;
        let val_color = "#8F0B0B";
        if(label_heads_cat[y_cat][label_].indexOf('*')>=0) val_color = "#FFFFFF";
        else if(recognized_index>=0)  val_color = "#FFF200";
        else if(isNaN(val))  val_color = "#FF000047";
        
        cell.innerHTML = `<input type="text"  id="${radio_name + label_}" style="width:30px; background-color:black; color:${val_color};" value="${val}" onchange="SA.dx_label('${seg_key}', '${label_}', this.value)">`;
        
       
        if(pred_labels && pred_labels[0] && pred_labels[0][label_])  //have prediction data
        {
            let pred_val = pred_labels[0][label_];
            if(pred_val==val)
            cell.innerHTML += `&nbsp:&nbsp<span style="color:green;">${pred_val}<span>`;
            
            else
            cell.innerHTML += `&nbsp:&nbsp<span style="color:red;">${pred_val}<span>`;
            predicted_labels_n++;
        }
        
    }// else {cell = row.insertCell(cell_i); cell_i++;}

    
    for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++) //valence, arousal etc
    {
        const label_ = label_heads_ord[y_ord];
        let val = (true_labels && true_labels[1] && true_labels[1][label_]) ? true_labels[1][label_] : NaN;
        
        thtml = "";
        //console.log(label_  + '\t' + val);
        if(isNaN(val) || (val==null))
        {
            val = NaN;
            thtml += `<input type="range" min="0" max="100" value="${val}" step="5" class="slider hideDiv" 
            id="${radio_name + label_}" 
            onchange="SA.dx_label('${seg_key}', '${label_}', this.value)">
            <small class="hide" id="${radio_name + label_}_i">&nbsp${label_}:${val}</small>
            </input>`;
        }
        else
        {
            let clr = "rgb(" + String(255-(val*255)) + ", " + String(val*255) + "," + String(val*60) + ")";
            val = Math.round(val * 100);
            thtml += `<input type="range" min="0" max="100" value="${val}" step="5" class="slider hideDiv" 
            id="${radio_name + label_}" style="background-color:${clr};" 
            onchange="SA.dx_label('${seg_key}', '${label_}', this.value)">
            <small class="hide" id="${radio_name + label_}_i">&nbsp${label_}:${val}</small>
            </input>`;
        }
        
        
        if(pred_labels && pred_labels[1] && pred_labels[1][label_])  //have prediction data
        {
            thtml += `<br>`;
            let val = pred_labels[1][label_];

            if(isNaN(val) || (val==null))
            {
                val = NaN;
                thtml += `<input type="range" min="0" max="100" value="${val}" class="slider hideDiv"  disabled>
                <small class="hide" >&nbsp${label_}:${val}</small>
                </input>`;
            }
            else
            {
                let clr = "rgb(" + String(255-(val*255)) + ", " + String(val*255) + "," + String(val*60) + ")";
                val = Math.round(val * 100);
                thtml += `<input type="range" min="0" max="100" value="${val}" class="slider hideDiv" 
                style="background-color:${clr};" disabled>
                <small class="hide" >&nbsp${label_}:${val}</small>
                </input>`;

                predicted_labels_n++;
            }
        }

        cell = row.insertCell(cell_i); cell_i++;
        cell.innerHTML = thtml;
    } //else {cell = row.insertCell(cell_i); cell_i++;}
    

    thtml = "";
    
    cell = row.insertCell(cell_i); cell_i++;  //predicted labels

    
    cell.innerHTML = `${predicted_labels_n}`;  
    
    
    thtml = null;
    cell = null;
    row = null;
}


export function shows_stats_table(data=null, db_id=null)
{
    
    if(!data) {check_label_heads(); if(db_id) data = collect_db_data(db_id);}
    if(data)
    {
        const results_div_elm = document.getElementById("results_div");
        results_div_elm.innerHTML = "";
        let thtml = `<div class="center-content w3-container">`;
        
        for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
        {
            
            const label_ = Object.keys(label_heads_cat[y_cat])[0];
            let label_unique_value = [];
            let label_class_samples = {};
            let label_class_duration = {};
            let label_class_correct = {};
            let label_class_wrong = {};
            let predicted_states = [0,0,0];
            

            for (let i=0; i<data[0].length; i++) 
            {

                if(data[4][i] && (data[4][i][0][label_]) && ((label_heads_cat[y_cat][label_].indexOf(data[4][i][0][label_]) >=0)|| (label_heads_cat[y_cat][label_].indexOf('*') >=0)))  //if has a valid true data
                {
                    if(label_unique_value.indexOf( data[4][i][0][label_] ) < 0) 
                    {
                        label_unique_value.push(data[4][i][0][label_]);
                        label_class_samples[data[4][i][0][label_]] = 0;
                        label_class_duration[data[4][i][0][label_]] = 0;
                        label_class_correct[data[4][i][0][label_]] = 0;
                        label_class_wrong[data[4][i][0][label_]] = 0;
                    }
                    label_class_samples[data[4][i][0][label_]]++;
                    label_class_duration[data[4][i][0][label_]] += parseFloat(data[1][i][1]);

                    
                    if(data[5][i] && (data[5][i][0]) && (data[5][i][0][label_]))   //if has prediction data
                    {
                        if(data[4][i][0][label_]==data[5][i][0][label_])    //if correct
                        {
                            predicted_states[0]++;
                            label_class_correct[data[4][i][0][label_]]++;
                        }
                        else
                        {
                            predicted_states[1]++;
                            label_class_wrong[data[4][i][0][label_]]++;
                        }
                    }
                    else    //blank
                    {
                        predicted_states[2]++;
                    }
                }
            }
            const accuracy = (predicted_states[0]*100/(predicted_states[0]+predicted_states[1])).toFixed(2);

            thtml += `<div class="w3-cell w3-border w3-border-pink w3-half"><ul>
                        <li>Label: ${label_}, Type: Class</li>`;
            thtml += `<li>Classes (${label_unique_value.length}): ${(label_unique_value.length<25)?label_unique_value:"Many"}</li>
                        <li>Accuracy: <span class="w3-tag w3-round w3-blue">${accuracy}%</span></li>
                      <li>Correct: ${predicted_states[0]}, Wrong ${predicted_states[1]}, NaN: ${predicted_states[2]}</li>`;

            if(label_unique_value.length<25)
            for (let unique_i=0; unique_i<label_unique_value.length; unique_i++)
            {
                const class_accuracy = (label_class_correct[label_unique_value[unique_i]]*100/(label_class_wrong[label_unique_value[unique_i]] + label_class_correct[label_unique_value[unique_i]])).toFixed(2);

                thtml += `<li>${label_unique_value[unique_i]} : <span> count: ${label_class_samples[label_unique_value[unique_i]]}, minutes: ${(label_class_duration[label_unique_value[unique_i]]/60).toFixed(2)}</span>
                 <span class="w3-tag w3-small w3-round w3-green">${label_class_correct[label_unique_value[unique_i]]} </span>
                 <span class="w3-tag w3-small w3-round w3-red">${label_class_wrong[label_unique_value[unique_i]]} </span>
                 <span class="w3-tag w3-small w3-round w3-blue">${class_accuracy}% </span>
                 </li>`;
            }
            thtml += `</ul></div>`;

        }
        thtml += `</div><div class="center-content w3-container">`;
        

        for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
        {
            const label_ = label_heads_ord[y_ord];
            let rmse = 0; let true_N = 0;  let pred_N = 0; let min_val = Infinity; let max_val = 0;
            for (let i=0; i<data[0].length; i++) 
            {
                if(data[4][i] && (data[4][i][1][label_]) && ((isNaN(data[4][i][1][label_]) || (data[4][i][1][label_]==null))==false))  //if has true data
                {
                    true_N++;
                    if(data[4][i][1][label_] < min_val) min_val = data[4][i][1][label_];
                    if(data[4][i][1][label_] > max_val) max_val = data[4][i][1][label_];

                    if(data[5][i] && (data[5][i][1]) && (data[5][i][1][label_]) && ((isNaN(data[5][i][1][label_]) || (data[5][i][1][label_]==null))==false))  //if has pred data
                    {
                        pred_N++;
                        rmse += Math.pow(data[5][i][1][label_] - data[4][i][1][label_], 2);
                    }
                }
            }
            //console.log(label_ + '\t' + true_N + '\t' + pred_N + '\t' + rmse);

            rmse = (pred_N > 0) ? (rmse / pred_N) : 0;
            rmse = Math.sqrt(rmse);
            thtml += `<div class="w3-cell w3-border w3-border-orange w3-third"><ul>
                        <li>Label: ${label_}, Type: Ordinal</li>`;

            thtml += `<li>Range: ${min_val} - ${max_val}</li>
                        <li>Samples: ${true_N}</li>
                        <li>Predicted: ${pred_N}</li>
                        <li>RMSE: ${rmse.toFixed(3)}</li>`;
            thtml += `</ul></div>`;
        }
        let now_time = new Date(); 
        now_time = now_time.getHours() + ':' + now_time.getMinutes() + ':' + now_time.getSeconds();
        thtml += `<p class="w3-text-gray w3-small"><br>Stats generated at: ${now_time}</p>`;
        thtml += `</div>`;
        results_div_elm.innerHTML = thtml;
        thtml = null;
        return;
        
    }
    
    else
    {
        document.getElementById("results_div").innerHTML = "<p class=\"w3-center w3-tiny\">No prediction results yet.</p>";
    }
}


function get_true_labels(seg_id)
{
    //Get labels from storage or a loaded DB index json file
    
    let this_origin_obj = null;
    let this_true_obj = window.localStorage.getItem(key_true + seg_id);

    if(this_true_obj)
    {
        this_true_obj = JSON.parse(this_true_obj);
    }
    else if(parse_DB_label)
    {
        this_origin_obj = labeling_mod.label_from_filename(seg_id);
        
        if(this_origin_obj && isObject(this_origin_obj[0]) && isObject(this_origin_obj[1])) this_true_obj = this_origin_obj;
        //else console.log("label not found : " + seg_id);
    }
    else
    {
        this_true_obj = null;
    }
    
    
    return [this_true_obj, this_origin_obj];
}

function get_pred_labels(seg_id)
{
    //Get labels from storage or a loaded DB index json file
    
    let pred_label_in_db = window.localStorage.getItem(key_pred + seg_id);
    if(pred_label_in_db) pred_label_in_db = JSON.parse(pred_label_in_db);
    else pred_label_in_db = null;
    
    return pred_label_in_db;
}


export function update_true_label(seg_id, label, new_val, clear_if_not_same=false)  //key_true
{
    //called from index
    //console.log(seg_id + '\t' + label + '\t' + new_val);
    
    //console.log('update_true_label');
    
    let true_label_in_db = get_true_labels(seg_id)[0];
    if(!true_label_in_db) true_label_in_db = [{},{}];
    let class_type = false;
    const radio_name = "r_" + seg_id + "_" + label;
    for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
    {
        if(Object.keys(label_heads_cat[y_cat])[0] == label)
        {
            
            if(!true_label_in_db[0]) true_label_in_db[0] = {};
            if(clear_if_not_same)
            {
                if(true_label_in_db[0][label])
                if(true_label_in_db[0][label]!=new_val) true_label_in_db[0][label] = null;
            }
            else true_label_in_db[0][label] = new_val;
            
            try { document.getElementById(radio_name).style.color = 'white'; } catch(e){}
            class_type = true;
            break;
        }
    }
    if(class_type == false)
    for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
    {
        if(label_heads_ord[y_ord] == label)
        {
            let val = parseInt(new_val)/100;
            if(!true_label_in_db[1]) true_label_in_db[1] = {};
            true_label_in_db[1][label] = parseInt(new_val)/100;

            
            try {
            let clr = "rgb(" + String(255-(val*255)) + ", " + String(val*255) + "," + String(val*60) + ")";
            document.getElementById(radio_name).style.backgroundColor = clr;
            document.getElementById(radio_name+ "_i").innerText = label + ":" + String(new_val); } catch(e){}
            break;
        }
    }
    //console.log(true_label_in_db);
    window.localStorage.setItem(key_true + seg_id, JSON.stringify(true_label_in_db));
    
    
    
}


export function update_pred_label(seg_id, label, new_val)  //key_pred
{
    //called from nn_db_results_handler
    
    //let val = new_val/100;
    
    let pred_label_in_db = get_pred_labels(seg_id);
    if(pred_label_in_db==null) pred_label_in_db = [{},{}];

    let true_label_in_db = get_true_labels(seg_id)[0];
    let true_label_found = null;

    let class_type = false;
    
    for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
    {
        if(Object.keys(label_heads_cat[y_cat])[0] == label)
        {
            pred_label_in_db[0][label] = new_val;
            class_type = true;

            if(true_label_in_db && true_label_in_db[0] && true_label_in_db[0][label])
            {
                true_label_found = true_label_in_db[0][label];
            }
            break;
        }
    }
    if(class_type == false)
    for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
    {
        if(label_heads_ord[y_ord] == label)
        {
            pred_label_in_db[1][label] = new_val;
            if(true_label_in_db && true_label_in_db[1] && true_label_in_db[1][label])
            {
                true_label_found = true_label_in_db[1][label];
            }
            break;
        }
    }
    
    window.localStorage.setItem(key_pred + seg_id, JSON.stringify(pred_label_in_db));
    
    
    return true_label_found;
}

function clear_wrong_predictions(db_id)
{

    let data = collect_db_data(db_id);

    if(data)
    {
        for (let i=0; i<data[0].length; i++) 
        {
            let seg_key = data[0][i];
            let true_labels = data[4][i];
            let pred_labels = data[5][i];

            if((true_labels) && (pred_labels))
            for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++) //emotion, sex, etc
            {
                const label_ = Object.keys(label_heads_cat[y_cat])[0]
                let val = (true_labels && true_labels[0] && true_labels[0][label_]) ? true_labels[0][label_] : NaN;
                
                if(val==null) val = NaN;
                
                else if(pred_labels && pred_labels[0] && pred_labels[0][label_])  //have prediction data
                {
                    let pred_val = pred_labels[0][label_];
                    if(pred_val!=val)
                    update_true_label(seg_key, label_, pred_val, true);
                }
            }
            
        }
        data = null;
    }
}

export function clear_labels(db_id, clear_true=true, clear_pred=true)
{
    
    
    if (clear_true==false && clear_pred==false)
    {
        clear_wrong_predictions(db_id);
    }
    else
    {
        let address_key = key_addr_db + String(db_id);
        console.log("Clearing labels for DB: " + (address_key));
        let _addresses = window.localStorage.getItem(address_key);
        if(_addresses)  
        {
            
            _addresses = JSON.parse(_addresses);    //seg key_name
            for(let ix=0; ix<_addresses.length; ix++)
            {
                if(clear_true)
                    window.localStorage.removeItem(key_true + _addresses[ix]);
                if(clear_pred)
                    window.localStorage.removeItem(key_pred + _addresses[ix]);
            
            }
        }
    }

}


export function clear_db_store()
{
    window.localStorage.clear();
    table_refresh_i = 0;
}


export function Download_DB(db_id, filetype='JSON', download_only_selected=false)
{
    console.log("Collecting features file");
    document.getElementById('msg').textContent = "Collecting features...";
    let data = collect_db_data(db_id);

    if(data)  
    {
        let samples_n = data[0].length;
        let label_heads = get_label_heads();

        function isLabelSelected(cats_labels, if_has_any_of_labels=false)
        {
            let found = 0;
            for (let y_cat=0; y_cat < label_heads[0].length; y_cat++)
            {
                let label_name = Object.keys(label_heads[0][y_cat])[0];
                if(cats_labels[label_name])
                {
                    if((label_heads[0][y_cat][label_name].indexOf(cats_labels[label_name]) >= 0) || (label_heads[0][y_cat][label_name].indexOf('*') >= 0) )
                    {
                        found++;
                    }
                }
            }
            //if_has_any_of_labels: means when there are two or more labels, but not all of them has been found.
            if (if_has_any_of_labels && found>= 1) return true;
            else if(found >= label_heads[0].length) return true;
            else return false;
        }

        if(filetype=='JSON')
        {
            let json_data = [];

            for (let i=0; i < samples_n; i++) 
            {
                if((!download_only_selected) || (data[4][i] && isLabelSelected(data[4][i][0])))
                {
                //[seg_key_collect, timestamps_collect, features_collect, origin_labels_collect, true_labels_collect, pred_labels_collect];
                let sk_splt = data[0][i].split('#');
                let this_sample = {file: sk_splt[1], seg:sk_splt[2], time: data[1][i], features: data[2][i], origin: data[3][i], true: data[4][i], pred: data[5][i]};
                json_data.push(this_sample);
                }
            }
            
            console.log("Downloading data JSON file");
            document.getElementById('msg').textContent = "Exporting data JSON";
            start_textfile_download(json_data,  "data_" + String(db_id) + ".json", true);
            json_data = null;
        }
        else
        {

                        
            const horizontal_spread_features = true;

            let csv_lines = "file,seg,t0,td,";
            if(horizontal_spread_features==false) csv_lines = "td,";

            let true_labels_keys_c = null;
            let true_labels_keys_o = null;
            if(data[4][0] && data[4][0][0])
            {
                true_labels_keys_c = Object.keys(data[4][0][0]);
                for (let lb=0; lb<true_labels_keys_c.length; lb++)
                    csv_lines += 'true_' + true_labels_keys_c[lb] + ',';
            }
            if(data[4][0] && data[4][0][1])
            {
                true_labels_keys_o = Object.keys(data[4][0][1]);
                for (let lb=0; lb<true_labels_keys_o.length; lb++)
                    csv_lines += 'true_' + true_labels_keys_o[lb] + ',';
            }
            
            let pred_labels_keys_c = null;
            let pred_labels_keys_o = null;
            if(data[5][0] && data[5][0][0])
            {
                pred_labels_keys_c = Object.keys(data[5][0][0]);
                for (let lb=0; lb<pred_labels_keys_c.length; lb++)
                    csv_lines += 'pred_' + pred_labels_keys_c[lb] + ',';
            }
            if(data[5][0] && data[5][0][1])
            {
                pred_labels_keys_o = Object.keys(data[5][0][1]);
                for (let lb=0; lb<pred_labels_keys_o.length; lb++)
                    csv_lines += 'pred_' + pred_labels_keys_o[lb] + ',';
            }

            if(horizontal_spread_features)
            for (let xft=0; xft<data[2][0].length;xft++) csv_lines += 'x' + String(xft) + ',';
            else csv_lines += 'X,Value,';

            csv_lines += '\r\n';

            let new_line = "";
            for (let i=0; i < samples_n; i++) 
            {
                new_line = "";
                if((true_labels_keys_c && data[4][i] && data[4][i][0]  && isLabelSelected(data[4][i][0])) || (!true_labels_keys_c || !data[4][i]) || !download_only_selected)
                {
                    //[seg_key_collect, timestamps_collect, features_collect, origin_labels_collect, true_labels_collect, pred_labels_collect];
                    let sk_splt = data[0][i].split('#');
                    if(horizontal_spread_features)
                    {
                    new_line += sk_splt[1] + ',' + sk_splt[2] + ',' + data[1][i][0] + ',' + data[1][i][1] + ',';

                    if(true_labels_keys_c)
                    {
                        for (let lb=0; lb<true_labels_keys_c.length; lb++)
                        {
                            if(data[4][i][0]) new_line += data[4][i][0][true_labels_keys_c[lb]];
                            new_line += ',';
                        }
                    }
                    if(true_labels_keys_o)
                    {
                        for (let lb=0; lb<true_labels_keys_o.length; lb++)
                        {
                            if(data[4][i][1]) new_line += data[4][i][1][true_labels_keys_o[lb]];
                            new_line += ',';
                        }
                    }
                    if(pred_labels_keys_c)
                    {
                        for (let lb=0; lb<pred_labels_keys_c.length; lb++)
                        {
                            if(data[5][i][0]) new_line += data[5][i][0][pred_labels_keys_c[lb]];
                            new_line += ',';
                        }
                    }
                    if(pred_labels_keys_o)
                    {
                        for (let lb=0; lb<pred_labels_keys_o.length; lb++)
                        {
                            if(data[5][i][1]) new_line += data[5][i][1][pred_labels_keys_o[lb]];
                            new_line += ',';
                        }
                    }

                    for (let xft=0; xft<data[2][i].length;xft++)
                    new_line += String(data[2][i][xft]) + ',';
                    
                    new_line += '\r\n';
                    csv_lines += new_line;
                    }
                    else
                    {
                    const normal_features = normalize_features_array(data[2]);
                    // In horizontal_spread_features==false, all features are inserted in a same column, and a 'X' indicates the feature
                    for (let xft=0; xft<data[2][i].length; xft++)
                    {

                        new_line += data[1][i][1] + ',';

                        if(true_labels_keys_c)
                        {
                            for (let lb=0; lb<true_labels_keys_c.length; lb++)
                            {
                                if(data[4][i][0]) new_line += data[4][i][0][true_labels_keys_c[lb]];
                                new_line += ',';
                            }
                        }
                        if(true_labels_keys_o)
                        {
                            for (let lb=0; lb<true_labels_keys_o.length; lb++)
                            {
                                if(data[4][i][1]) new_line += data[4][i][1][true_labels_keys_o[lb]];
                                new_line += ',';
                            }
                        }
                        if(pred_labels_keys_c)
                        {
                            for (let lb=0; lb<pred_labels_keys_c.length; lb++)
                            {
                                if(data[5][i][0]) new_line += data[5][i][0][pred_labels_keys_c[lb]];
                                new_line += ',';
                            }
                        }
                        if(pred_labels_keys_o)
                        {
                            for (let lb=0; lb<pred_labels_keys_o.length; lb++)
                            {
                                if(data[5][i][1]) new_line += data[5][i][1][pred_labels_keys_o[lb]];
                                new_line += ',';
                            }
                        }
                        
                        new_line += String(xft+1) + ',';
                        new_line += String(normal_features[i][xft]) + ',';
                        
                        new_line += '\r\n';
                        csv_lines += new_line;
                    }
                    }
                }
            }
            
            console.log("Downloading data CSV file");
            document.getElementById('msg').textContent = "Exporting data CSV";
            start_textfile_download(csv_lines, "data_" + String(db_id) + ".csv", false);
            csv_lines = null;
        }
    }
    else
    {
        console.warn("No data in DB");
        document.getElementById('msg').textContent = "No data to export";
    }
}

function normalize_features_array(features_array)
{
    const N_features = features_array[0].length;
    let minis = new Array(N_features).fill(Infinity);
    let maxes = new Array(N_features).fill(-Infinity);
    for (let i=0; i < features_array.length; i++) 
    {
        for (let xft=0; xft<N_features; xft++)
        {
            if(features_array[i][xft] < minis[xft]) minis[xft] = features_array[i][xft];
            if(features_array[i][xft] > maxes[xft]) maxes[xft] = features_array[i][xft];
        }
    }

    for (let i=0; i < features_array.length; i++) 
    {
        for (let xft=0; xft<N_features; xft++)
        {
            features_array[i][xft] = (features_array[i][xft] - minis[xft]) / (maxes[xft] - minis[xft]);
        }
    }
    return features_array;
}

function start_textfile_download(data_text, filename, isJson=true)
{
    //Convert JSON Array to string.
    //Convert JSON string to BLOB.
    var blob1 = null;
    if(isJson)
        blob1 = new Blob([JSON.stringify(data_text)], { type: "text/plain;charset=utf-8" });
    else
        blob1 = new Blob([data_text], { type: "text/plain;charset=utf-8" });
    data_text = null;

    //Check the Browser.
    var isIE = false || !!document.documentMode;
    if (isIE) {
        window.navigator.msSaveBlob(blob1, filename);
    } else {
        var url = window.URL || window.webkitURL;
        var link = url.createObjectURL(blob1);
        var a = document.createElement("a");
        
        a.download = filename;
        a.href = link;
        document.body.appendChild(a);
        
        a.click();
        
        document.getElementById('msg').textContent = filename + " download started";
        
        /*
        readTextFile(link, function(text){
            Classifier.train_main(text);
        });
        */
        
        document.body.removeChild(a);
    }
}




function isObject(objValue) {
    return objValue && typeof objValue === 'object' && objValue.constructor === Object;
  }


export function Load_JSON_Data(db_id, json_string)  //seg_key, key_ts, key_true, key_pred
{
    
    
    let new_data = JSON.parse(json_string);
    if(new_data && new_data[0] && new_data[0].file && new_data[0].features)
    {
        let samples_n = new_data.length;
        alert("Loading " + String(samples_n) + " samples. It might take few minutes.");
        document.getElementById('msg').textContent = "Loading " + String(samples_n)  + " samples from JSON";
        let seg_keys = [];
        for (let i=0; i < samples_n; i++) 
        {
            //console.log(new_data[i]);
            
            const this_seg_key = String(db_id) + '#' + new_data[i].file + '#' + new_data[i].seg;

            //if(sep_utt) this_seg_key = this_seg_key + '#' + new_data[i].seg;

            //if(new_data[i].features.length < syl_seg_features_N) { alert("Invalid feature length "+(new_data[i].features.length) );  }
            
            //remove extra ctx features at the tail end, bcz they are not stored in mem
            //if(new_data[i].features.length > syl_seg_features_N) new_data[i].features.splice(syl_seg_features_N);
            
            setTimeout(function(){add_data_with_delay(this_seg_key, new_data[i].features, new_data[i].time, new_data[i].true, new_data[i].pred, i==(samples_n-1));}, parseInt((i/100)*1) + 3000 );
            seg_keys.push(this_seg_key);
            //add_data_with_delay(this_seg_key, new_data[i].features, new_data[i].time, new_data[i].true, new_data[i].pred);

        }
        update_address_table(db_id, null, seg_keys);
    }
    else
    {
        alert("Invalid data file");
    }
    return;
}


function add_data_with_delay(this_seg_key, data_features, data_time, data_true=null, data_pred=null, is_last=false)
{
    window.localStorage.setItem(this_seg_key, JSON.stringify(data_features));
    window.localStorage.setItem(key_ts + this_seg_key, JSON.stringify(data_time));
    
    if((data_true) && (isObject(data_true[0]))  && (isObject(data_true[1])))
        window.localStorage.setItem(key_true + this_seg_key, JSON.stringify(data_true));
    if((data_pred) && (isObject(data_pred[0]))  && (isObject(data_pred[1])))
        window.localStorage.setItem(key_pred + this_seg_key, JSON.stringify(data_pred));
    
        if(is_last) document.getElementById('msg').textContent = "Loaded all samples from JSON";
}

/*

export function Download_DB_JSON_2(db_id)
{
    console.log("Collecting features file");
    document.getElementById('msg').textContent = "Exporting features...";
    let address_key = key_addr_db + String(db_id);
    let _addresses = window.localStorage.getItem(address_key);
    if(_addresses)  
    {
        let labels_collect = [];
        let features_collect = [];
        _addresses = JSON.parse(_addresses);
        for(let ix=0; ix<_addresses.length; ix++)
        {
            let this_file_data = window.localStorage.getItem(_addresses[ix]);
            if(this_file_data)
            {
                this_file_data = JSON.parse(this_file_data);
                let emo_labels = labeling_mod.label_from_filename(_addresses[ix]);
                labels_collect.push(emo_labels);
                features_collect.push(this_file_data);
                //console.log(emo_labels);
                //console.log(this_file_data);
            }
            else
            {
                console.warn("Missing file: " + _addresses[ix])
            }
        }
        let json1 = [];
        json1.push(labels_collect);
        json1.push(features_collect);
        labels_collect = null;
        features_collect = null;
        console.log("Downloading features file");
        document.getElementById('msg').textContent = "Exporting JSON";
        start_download_JSON(json1);
    }
    else
    {
        console.warn("No data in DB");
        document.getElementById('msg').textContent = "No data to export";
    }
}


*/