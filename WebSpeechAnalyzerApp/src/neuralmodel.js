

const storage_mod = require('./localstore.js');
const aux = require('./neuralmodel_aux.js');
const stats = require('./stats.js'); //uses arrayMax while data balancing
const models_dir = './WebSpeechAnalyzerApp/dist/nnmodel/';

console.log('ml5 version:', ml5.version);
//https://learn.ml5js.org/#/reference/neural-network

var models_cats = null; //models object models_cats[db_id][label_name]
var models_ords = null;
const label_types = {cat: "cats", ord: "ords"};

var nn_settings = {ML_enable:false, loading_busy:0};

var ccc_arr_y1 = [];
var ccc_arr_y2 = [];

export function load_ready(db_id, label_type, label_name)  //called from index setup
{
    const model_link = models_dir+db_id+'/'+label_type+'_'+label_name+'/model.json';

    return new Promise((resolve, reject)=>{
    
        load_single_nn(db_id, label_type, label_name, false, null, model_link).then(function()
        {
            resolve(1);
        }).catch((err)=>{
            
            console.error(err);
            
            document.getElementById('nn_msg').textContent = err;
            document.getElementById('msg').textContent = err;
            reject(err);
        });
    });
}


function await_busy_loading ()
{
    return new Promise((resolve)=>{
        if(nn_settings.loading_busy!=0) 
        {
            setTimeout(() => {
                await_busy_loading().then((value) => { resolve(value); });
                }, 1000);
        }
        else resolve(1);
    });
}


export function load_single_nn(db_id, label_type, label_name, reload=false, load_files=null, load_link=null)
{
    return new Promise((resolve, reject)=>{
        await_busy_loading().then(() => {
        nn_settings.loading_busy = 1;   //0 = idle, 1 = preparing, 2 = loading
        if((reload==false) && (((label_type==label_types.cat) && (models_cats) && models_cats[db_id] && models_cats[db_id][label_name] && (models_cats[db_id][label_name].ready)) ||
                                ((label_type==label_types.ord) && (models_ords) && models_ords[db_id] && models_ords[db_id][label_name] && (models_ords[db_id][label_name].ready))))
        {
            try { document.getElementById('pred_' + label_type + '_' + label_name).disabled = false; } catch(e){}
            nn_settings.loading_busy = 0;
            resolve(1);
        }
        else
        {
            console.log("Loading model\t" + label_type + '\t' + label_name);
            
            if (((label_type==label_types.cat)|| (label_type==label_types.ord))==false)
            {
                reject("Invalid label type " + label_type);
                return;
            }
            
            let success_load = false;
            let loaded_model  = ml5.neuralNetwork();

            function modelLoadedCallback()
            {
                console.log("Model load success");
                
                if(label_type==label_types.cat)
                {
                    if(!models_cats) models_cats = [];
                    if(!models_cats[db_id]) models_cats[db_id] = {};
                    models_cats[db_id][label_name] = loaded_model;  //set to global after successfully loaded
                    
                }
                else if(label_type==label_types.ord)
                {
                    if(!models_ords) models_ords = [];
                    if(!models_ords[db_id]) models_ords[db_id] = {};
                    models_ords[db_id][label_name] = loaded_model; 
                }
                success_load = true;
                if(load_files)
                {
                    make_ML_div(db_id);
                    document.getElementById('nn_msg').textContent = "Model loaded from files for " + label_name  + " DB:" + db_id;
                    if(nn_settings.ML_enable)
                    document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
                }
                else
                {
                    make_ML_div(db_id);
                    document.getElementById('nn_msg').textContent = "Model loaded from web for " + label_name + " DB:" + db_id;
                    if(nn_settings.ML_enable)
                    document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
                }
                resolve(1);
                nn_settings.loading_busy = 0;
            }
            
            if(load_files)
            {
                if(load_files.length != 3)
                {
                    alert("Please load the 3 files of model, model_meta and weights bin");
                    reject(0);
                    nn_settings.loading_busy = 0;
                }
                else
                {
                    nn_settings.loading_busy = 2;
                    loaded_model.load(load_files, modelLoadedCallback);
                }
            }
            else if(load_link)
            {
                console.log("Loading from:\t" + load_link);
                nn_settings.loading_busy = 2;
                loaded_model.load(load_link, modelLoadedCallback);
            }
            else
            {
                reject("No model available to load");
                nn_settings.loading_busy = 0; 
            }
            
            setTimeout(function(){
                {
                    if(nn_settings.loading_busy==2)
                    {
                        loaded_model = null;
                        if(!success_load)
                        {
                            reject("Timeout while loading model for " + String(label_name));
                            nn_settings.loading_busy = 0;
                        }
                    }
                }
            }, 20000);
        }
        
        });
       });
}



export function train_nn(db_id, label_type, label_name)
{
    // Step 1: load data or create some data 
    //let label_name = 'A';
    //console.log(document.getElementById('text_NN_options_' + label_name).value);
    
    let options = null;
    try
    {
        options = JSON.parse(document.getElementById('text_NN_options_' + label_type +'_'+ label_name).value);
    }
    catch(e){ alert(e); return;}
    if(aux.isObject(options)==false) {alert("Invalid syntax"); return}
    document.getElementById('nn_train_modal_' + label_type +'_'+ label_name).style.display='none';
    
    let epochs_ = parseInt(document.getElementById('epochs_' + label_type +'_'+ label_name).value); if(epochs_ < 1) epochs_ = 10;
    let batchSize_ = parseInt(document.getElementById('batch_' + label_type +'_'+ label_name).value); if(batchSize_ < 1) batchSize_ = 10;

    document.getElementById('nn_msg').textContent = "Processing data for training for label " + label_name;
    let train_data = storage_mod.collect_db_data(db_id);

    if(train_data)
    {
        const balance = true;
        // Step 2: set your neural network options
        
        console.log("Training " + label_type + "\t" + label_name);
        console.log(options);
        const trainingOptions = { epochs: epochs_ , batchSize: batchSize_ };
        console.log(trainingOptions);
        
        // Step 3: initialize your neural network
        //nn_model = null;
        let new_nn_model = ml5.neuralNetwork(options);

        // Step 4: add train_data to the neural network
        let data_len = train_data[0].length;
        let sample_count = 0;
        
        let label_heads = storage_mod.get_label_heads();
        if((label_type==label_types.cat) && (label_heads[0]))
        {
            let label_heads_cat = label_heads[0];
            let label_ = null; let label_classes = [];
            for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
            if(Object.keys(label_heads_cat[y_cat])[0] == label_name)
            {
                label_ = label_name;
                label_classes = label_heads_cat[y_cat][label_];
                break;
            }
            console.log(label_  +'\t' + label_classes);
            
            let count_n = new Array(label_classes.length).fill(0);

            function add_data(data_i, only_this_label=null)
            {
                if( train_data[4][data_i] && (aux.isObject(train_data[4][data_i][0])) && (train_data[4][data_i][0][label_] != null) )
                {
                    const label_i = label_classes.indexOf(train_data[4][data_i][0][label_]);
                    
                    if( ((only_this_label==null)||(label_i==only_this_label))  && ((label_i>=0)||(label_classes.indexOf('*')>=0)) )
                    {
                        let this_out = train_data[4][data_i][0][label_name];
                        
                        const output = {y: String(this_out)};   //doesn't work without String
                        const input = train_data[2][data_i];

                        new_nn_model.addData(input, output);

                        if(label_i>=0) count_n[label_i]++;

                        if(only_this_label==null)// before balancing
                            sample_count++;
                    }
                }
            }

            for (let i=0; i<data_len; i++)  add_data(i);
            console.log("Samples: " + String(count_n));

            if(sample_count<10) 
            {
                document.getElementById('nn_msg').textContent = "Sample size "+String(sample_count)+"/"+ String(data_len)+" too small for training";
                return;
            }
            
            if(balance)
            {
                const max_n = stats.arrayMax(count_n);
                if(max_n > 0)
                for(let cl=0; cl < label_classes.length; cl++)
                {
                    while((count_n[cl]<max_n) && (count_n[cl] > 3))
                    for (let i=0; i<data_len; i++) 
                    {
                        if(count_n[cl]<max_n) add_data(i, cl);
                        if(count_n[cl]>=max_n) break;
                    }
                }
                console.log("Balanced:"); console.log(count_n);
            }
            

        }
        else if((label_type==label_types.ord) && (label_heads[1]))
        {
            let label_heads_ord = label_heads[1];
            let label_ = null;
            for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
            if(label_heads_ord[y_ord] == label_name)
            {
                label_ = label_name;
                break;
            }
            const ranges = [0.25,0.5,0.75,1.0];
            const ranges_N = ranges.length;
            let count_n = new Array(ranges_N).fill(0);
            
            function add_data(data_i, only_this_label=null, add_zero=true)
            {
                if( train_data[4][data_i] && (aux.isObject(train_data[4][data_i][1])) && (train_data[4][data_i][1][label_] != null) )
                {
                    if((add_zero) || (train_data[4][data_i][1][label_] !=0 ))
                    {
                        let this_out = train_data[4][data_i][1][label_];
                        let label_i = 0; while(label_i<=ranges_N-1) {if (this_out<=ranges[label_i]) break; else label_i++;};
                        
                        if( ((only_this_label==null)||(label_i==only_this_label)) && (label_i <= ranges_N-1))
                        {
                            const output = {y: this_out};
                            
                            const input = train_data[2][data_i];

                            
                            new_nn_model.addData(input, output);
                            
                            count_n[label_i]++;
                            if(only_this_label==null)// before balancing
                                sample_count++;
                        }
                    }
                }
            }

            for (let i=0; i<data_len; i++)  add_data(i);
            console.log("Samples: " + String(sample_count));
            console.log(count_n);

            if(sample_count<10) 
            {
                document.getElementById('nn_msg').textContent = "Sample size "+String(sample_count)+"/"+ String(data_len)+" too small for training";
                return;
            }
            if(balance)
            {
                const max_n = stats.arrayMax(count_n);
                
                if(max_n > 3)
                for(let cl=0; cl < ranges_N; cl++)
                {
                    while((count_n[cl] < max_n) && (count_n[cl] > 3))
                    for (let i=0; i<data_len; i++) 
                    {
                        if(count_n[cl] < max_n) add_data(i, cl);
                        if(count_n[cl] >= max_n) break;
                    }
                }
                console.log("Balanced:"); console.log(count_n);
            }
        }
        else
        {
            console.error("Invalid label type");
            return;
        }
        
        
        document.getElementById('nn_msg').innerHTML = `Using ${sample_count}/${data_len} samples to train the model<br>`;
        document.getElementById('nn_msg').innerHTML += `<div class="w3-animate-fading"><b>Starting training for ${label_name}...</b></div>`;
        
        // Step 5: normalize your train_data;
        new_nn_model.normalizeData();
        
        
        // Step 6: train your neural network
        //const trainingOptions = { epochs: 32, batchSize: 12 };

        try
        {
            new_nn_model.train(trainingOptions, whileTraining, finishedTraining);
        }
        catch(e)
        {
            console.error(e);
            document.getElementById('nn_msg').innerText = e;
            new_nn_model = null; //error in training
        }
        

        function whileTraining(epoch, loss) {
            
            document.getElementById('nn_msg').textContent = "Epoch: " + epoch + ", loss: " + loss.loss.toFixed(3) + ", accuracy: " + loss.acc.toFixed(3);
        }
        
        // Step 7: use the trained model
        function finishedTraining()
        {
            
            //new_nn_model.save("model");
            if(label_type==label_types.cat)
            {
                if(!models_cats) models_cats = [];
                if(!models_cats[db_id]) models_cats[db_id] = {};
                models_cats[db_id][label_name] = null;
                models_cats[db_id][label_name] = new_nn_model;

                document.getElementById('nn_msg').textContent = "Finished training (c). New model is loaded for label: " + label_name;
                document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
            }
            else if(label_type==label_types.ord)
            {
                if(!models_ords) models_ords = [];
                if(!models_ords[db_id]) models_ords[db_id] = {};
                models_ords[db_id][label_name] = null;
                models_ords[db_id][label_name] = new_nn_model;

                document.getElementById('nn_msg').textContent = "Finished training (o). New model is loaded for label: " + label_name;

                document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
                
            }
        }
        
        train_data = null;
    }
    else
    {
        document.getElementById('nn_msg').textContent = "No data for training";
    }
}




var prediction_error = false;

export async function predict_db_nn(db_id, label_type, label_name)
{
    const model_link = models_dir+db_id+'/'+label_type+'_'+label_name+'/model.json';
    let test_data = storage_mod.collect_db_data(db_id);
    

    console.log('predict_db_nn' + '\t' + label_type + '\t' + label_name);
    load_single_nn(db_id, label_type, label_name, false, null, model_link).then(function()
    {
        
        if (((label_type==label_types.cat) && (models_cats[db_id][label_name].ready)) || ((label_type==label_types.ord) && (models_ords[db_id][label_name].ready)))
        {
            if(test_data)
            {
                if (label_type==label_types.cat) console.log(models_cats[db_id][label_name].options);
                else if(label_type==label_types.ord) console.log(models_ords[db_id][label_name].options);

                document.getElementById('nn_msg').textContent = "Predicting label " + label_name;
                prediction_error = false;

                for (let i=0; i<test_data[0].length; i++) 
                {
                    //const test_input = test_data[2][i];
                    const handleResults = function(error_out, result_out) { 
                        nn_db_results_handler(error_out, result_out, label_type, label_name, test_data[0][i]); //last arg is seg_key
                    }; //pass the seg_key

                    setTimeout(function(){
                    if (label_type==label_types.cat)
                        models_cats[db_id][label_name].classify(test_data[2][i], handleResults);
                    else if(label_type==label_types.ord)
                        models_ords[db_id][label_name].predict(test_data[2][i], handleResults);
                    }, parseInt(i/10));

                    if(prediction_error) break;
                }

                function after_finish_prediction()
                {
                    document.getElementById('nn_msg').textContent = "Finished prediction of " + String(label_name);
                    //calc_ccc();
                    storage_mod.shows_stats_table(null, db_id);
                    //storage_mod.Refresh_Table(db_id);
                }
                
                window.setTimeout(after_finish_prediction, 3000 + parseInt(test_data[0].length/10));

            }
            else
            {
                document.getElementById('nn_msg').textContent = "No data for prediction";
            }
        }
        else
        {
            document.getElementById('nn_msg').textContent = "ML model not loaded or trained yet";
        }
    }).catch((err)=>{
        
        console.error(err);
        document.getElementById('nn_msg').textContent = err;
        
    });

}

function calc_ccc()
{
    //under construction
    let y2_mean = stats.only_mean(ccc_arr_y2);
    let y2_var = stats.variance(ccc_arr_y2);

    if(ccc_arr_y1.length>0) //ordinal labels available
    {
        let y1_mean = stats.only_mean(ccc_arr_y1);
        let y1_var = stats.variance(ccc_arr_y1);
        let co_var = stats.covariance(ccc_arr_y1, ccc_arr_y1);
    
        let ccc_val = (2*co_var) / (y1_var + y2_var + Math.pow(y2_mean - y1_mean, 2));
        console.log("ccc_val:\t" + ccc_val);
        console.log("True Probability mean, var:\t" + y1_mean + '\t' + y1_var);
    }

    console.log("Pred Probability mean, var:\t" + y2_mean + '\t' + y2_var);
    
    return y2_mean;
}

function nn_db_results_handler(error_out, result_out, label_type, label_name, seg_key)
{
    if(error_out)
    {
        prediction_error = true;
        console.error(error_out);
        
        document.getElementById('msm').innerHTML += "Prediction error. Probably input data/shape is incorrect. Make sure the output level as expected by the NN model.";
        document.getElementById('nn_msg').innerHTML += "ERROR: " + String (seg_key) + ', '+ error_out + '. <br>';
    }
    //console.log(seg_key);
    
    if(result_out)
    {
        if(label_type == label_types.cat)
        {
            let max_confidence = 0, top_label = null;
            for (let ol=0; ol < result_out.length; ol++)
            {
                if(result_out[ol].confidence > max_confidence)
                {
                    max_confidence = result_out[ol].confidence;
                    top_label = result_out[ol].label;
                }
            }
            //console.log(label_name +'\t' +top_label + '\t' + max_confidence);
            let true_label_found = storage_mod.update_pred_label(seg_key, label_name, top_label);
            true_label_found = null;
            
        }
        else if(label_type == label_types.ord)
        {
            let true_label_found = storage_mod.update_pred_label(seg_key, label_name, result_out[0].value);
            true_label_found = null;
        }
    }

}




export function predict_single(db_id, test_input, callback_func, label_type, label_name)
{
    
    const model_link = models_dir+db_id+'/'+label_type+'_'+label_name+'/model.json';
    load_single_nn(db_id, label_type, label_name, false, null, model_link).then(function()
    {
        if (((label_type==label_types.cat) && (models_cats[db_id][label_name].ready)) || ((label_type==label_types.ord) && (models_ords[db_id][label_name].ready)))
        {
            if(test_input)
            {
                function seg_results_handler(error_out, result_out, callback_funcx)
                {
                    if(error_out)
                    {
                        console.error(error_out);
                        document.getElementById('nn_msg').innerHTML += " ERROR: " + error_out + '. <br>';
                    }
                    if((result_out) && (callback_funcx))
                    callback_funcx(result_out);
                }
                const after_prediction = function(error_out, result_out) { seg_results_handler(error_out, result_out, callback_func); };
                
                if (label_type==label_types.cat)
                    models_cats[db_id][label_name].classifyMultiple(test_input, after_prediction);
                else if(label_type==label_types.ord)
                    models_ords[db_id][label_name].predictMultiple(test_input, after_prediction);
                
            }
            else
            {
                document.getElementById('nn_msg').textContent = "No data received for prediction";
            }
        }
        else
        {
            document.getElementById('nn_msg').textContent = "ML model not loaded or trained yet";
        }

    }).catch((err)=>{
            
        console.error(err);
        document.getElementById('nn_msg').textContent = err;
        
    });
    
}





export function download_nn_model(db_id, label_type, label_name)
{
    function after_nn_export()
    {
        document.getElementById('nn_msg').textContent = "Model download started for " + label_name;
    }
    
    if((label_type==label_types.cat) && (models_cats)  && (models_cats[db_id]) && (models_cats[db_id][label_name]))
    {
        models_cats[db_id][label_name].save("model", after_nn_export);
    } 
    else if((label_type==label_types.ord) && (models_ords) && (models_ords[db_id]) && (models_ords[db_id][label_name]))
    {
        models_ords[db_id][label_name].save("model", after_nn_export);
    }
    else
    {
        document.getElementById('nn_msg').textContent = "ML model is not loaded or trained yet for " + label_name;
    }
}



export function make_ML_div(db_id, enable_disable=null) //called from index and loading functions
{
    
    if(enable_disable) nn_settings.ML_enable = enable_disable;

    if(nn_settings.ML_enable)
    {
        let label_heads = storage_mod.get_label_heads();
        
        if((label_heads) && (label_heads.length>=2))
        {
            let label_heads_cat = label_heads[0];
            let label_heads_ord = label_heads[1];
            
            document.getElementById("ML_training_div").innerHTML = `<h3 class="w3-opacity">ML Training</h3>`;
            let thtml_b = "";      //html string for div box
            let thtml_m = "";   //html string for modals
            
            for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
            {
                const label_type = label_types.cat;
                
                if(aux.isObject(label_heads_cat[y_cat]))
                {
                    const label_name = Object.keys(label_heads_cat[y_cat])[0];
                    let model_options = "{}";
                    if(models_cats && models_cats[db_id] && models_cats[db_id][label_name]) model_options = JSON.stringify(models_cats[db_id][label_name].options);
                    else model_options = aux.nn_default_options_cats;
                    
                    //use default options when model is not loaded or available on server

                    thtml_b += aux.build_ML_box(db_id, label_type, label_name, 'lime');
                    thtml_m += aux.build_ML_modal(db_id, label_type, label_name, model_options, aux.nn_default_options_cats);
                }
            }

            for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
            {
                const label_type = label_types.ord;
                
                if(label_heads_ord[y_ord]!=null)
                {
                    const label_name = label_heads_ord[y_ord];
                    
                    let model_options = "{}";
                    if(models_ords && models_ords[db_id] && models_ords[db_id][label_name]) model_options = JSON.stringify(models_ords[db_id][label_name].options);
                    else model_options = aux.nn_default_options_ords;

                    thtml_b += aux.build_ML_box(db_id, label_type, label_name, 'indigo');
                    thtml_m += aux.build_ML_modal(db_id, label_type, label_name, model_options, aux.nn_default_options_ords);
                }
            }
            document.getElementById("ML_training_div").innerHTML += thtml_b;
            document.getElementById("ML_training_div_modals").innerHTML = thtml_m;
            thtml_b = null;
            thtml_m = null;


            //pre-load models - cats
            for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
            {
                const label_type = label_types.cat;
                if(aux.isObject(label_heads_cat[y_cat]))
                {
                    const label_name = Object.keys(label_heads_cat[y_cat])[0];
                    if(label_name=='emotion')   //only for emotion - debug
                    {
                        const model_link = models_dir+db_id+'/'+label_type+'_'+label_name+'/model.json';
                        load_single_nn(db_id, label_type, label_name, false, null, model_link).then(function()
                        {

                        }).catch((err)=>{
                        
                            console.error(err);
                            document.getElementById('nn_msg').textContent = err;
                            
                        });
                    }
                }
            }
            
            //pre-load models - ords
            for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
            {
                const label_type = label_types.ord;
                
                if(label_heads_ord[y_ord]!=null)
                {
                    const label_name = label_heads_ord[y_ord];
                    
                    if(label_name=='V')   //only for V - debug
                    {
                        const model_link = models_dir+db_id+'/'+label_type+'_'+label_name+'/model.json';
                        load_single_nn(db_id, label_type, label_name, false, null, model_link).then(function()
                        {

                        }).catch((err)=>{
                        
                            console.error(err);
                            document.getElementById('nn_msg').textContent = err;
                        });
                    }
                }
            }

        }
    }
    else
    {
        document.getElementById("ML_training_div").innerHTML = "";
    }
}



var knnClassifier = null; //not used

export function train_knn(db_id, label_type, label_name)    //not used, initial development phase
{
    
    document.getElementById('nn_msg').textContent = "Processing data for training for label " + label_name;
    let train_data = storage_mod.collect_db_data(db_id);

    if(train_data)
    {
        console.log("Training " + label_type + "\t" + label_name);

        // Step 4: add train_data to the neural network
        let data_len = train_data[0].length;
        let sample_count = 0;

        
        
        let label_heads = storage_mod.get_label_heads();
        if((label_type==label_types.cat) && (label_heads[0]))
        {
            let label_heads_cat = label_heads[0];
            let label_ = null; let label_classes = [];
            for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
            if(Object.keys(label_heads_cat[y_cat])[0] == label_name)
            {
                label_ = label_name;
                label_classes = label_heads_cat[y_cat][label_];
                break;
            }
            console.log(label_  +'\t' + label_classes);
            
            let count_n = new Array(label_classes.length).fill(0);

            knnClassifier = null;
            knnClassifier = ml5.KNNClassifier();

            function add_data(data_i, only_this_label=null)
            {
                if( train_data[4][data_i] && (aux.isObject(train_data[4][data_i][0])) && (train_data[4][data_i][0][label_] != null) )
                {
                    const label_i = label_classes.indexOf(train_data[4][data_i][0][label_]);
                    
                    if( ((only_this_label==null)||(label_i==only_this_label))  && ((label_i>=0)||(label_classes.indexOf('*')>=0)) )
                    {
                        const label = train_data[4][data_i][0][label_name];
                        const features = train_data[2][data_i];

                        knnClassifier.addExample(features, label);

                        if(label_i>=0) count_n[label_i]++;

                        if(only_this_label==null)// before balancing
                            sample_count++;
                    }
                }
            }
            const split_at = parseInt(data_len*0.8);

            for (let i=0; i<split_at; i++)  add_data(i);
            console.log("Samples: " + String(count_n));

            if(sample_count<10) 
            {
                document.getElementById('nn_msg').textContent = "Sample size "+String(sample_count)+"/"+ String(data_len)+" too small for training";
                return;
            }
            console.log("Samples added.");

            let all_n = 0; let correct_n = 0;
            function classify_data(data_i, the_end=false)
            {
                if( train_data[4][data_i] && (aux.isObject(train_data[4][data_i][0])) && (train_data[4][data_i][0][label_] != null) )
                {
                    const label_i = label_classes.indexOf(train_data[4][data_i][0][label_]);
                    
                    if ((label_i>=0)||(label_classes.indexOf('*')>=0)) 
                    {
                        const true_label = train_data[4][data_i][0][label_name];
                        const features = train_data[2][data_i];

                        // Use KNN Classifier to classify these features
                        knnClassifier.classify(features, 10, function(err, result) {
                            if(err) console.error(err);
                            else
                            {
                                //console.log(result); // result.label is the predicted label
                                
                                all_n++;
                                if(result.label == true_label) correct_n++;
                                
                                if(the_end)
                                console.log(correct_n/all_n);
                            }
                        });
                    }
                }
            }

            for (let i=split_at; i<split_at+100; i++)  classify_data(i, i==split_at+99);

        }
        else
        {
            console.error("Invalid label type");
            return;
        }
    }
}



/*
export function make_ML_div(db_id, enable_disable=null) //called from index and loading functions
{
    
    if(enable_disable) nn_settings.ML_enable = enable_disable;

    if(nn_settings.ML_enable)
    {

    let label_heads = storage_mod.get_label_heads();
    
    if((label_heads) && (label_heads.length>=2))
    {
        let label_heads_cat = label_heads[0];
        let label_heads_ord = label_heads[1];
        
        document.getElementById("ML_training_div").innerHTML = `<h3 class="w3-opacity">ML Training</h3>`;
        let thtml = "";
        let thtml_m = "";

        //buttons
        
        for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
        {
            const label_type = label_types.cat;
            
            if(aux.isObject(label_heads_cat[y_cat]))
            {
            const label_name = Object.keys(label_heads_cat[y_cat])[0];
            thtml += `<div class="w3-cell w3-border w3-border-lime" style="width:100px; margin-left:10px; display: inline-block;">
                        <h5>${label_name}</h5>
                        <div class="w3-row w3-margin-top">
                        <button onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='block'" class="w3-button w3-tiny w3-border w3-border-indigo">Model</button>
                        </div>
                        <div class="w3-row w3-margin-top">
                            <button onclick="SA.start_nn_prediction('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom"  id="pred_${label_type}_${label_name}" disabled>Predict</button>
                        </div>
                    </div>`;
            
           //Train settings modals
            thtml_m += `<div id="nn_train_modal_${label_type}_${label_name}" class="w3-modal w3-animate-opacity">
                        <div class="w3-modal-content w3-card-4 w3-animate-zoom">

                        <header class="w3-container w3-theme-d1"> 
                        <span onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'" 
                        class="w3-button w3-red w3-xlarge w3-display-topright">&times;</span>
                        <h2>Classification NN for ${label_name}</h2>
                        </header>

                        <div class="w3-container w3-theme-d2 w3-small w3-left-align">
                            <div class="w3-row w3-padding-small ">
                                
                                <p>Download the trained model or load a pre-trained model</p>
                                    
                                <div class="w3-col m2">
                                    <button onclick="SA.download_nn_model('${label_type}','${label_name}')" class="w3-button w3-tiny w3-border w3-indigo">Download Model</button>
                                </div>

                                <div class="w3-col m2">
                                <input type="file" id="nn_mod${label_type}_${label_name}" name="nn_${label_type}_${label_name}[]" onchange="SA.load_files_nn_model(this.files, '${label_type}', '${label_name}')" multiple="" class="w3-button w3-hover-border-khaki w3-padding"/>

                                </div>
                            </div>
                            
                            <h6>Model training options</h6>

                            <button onclick="document.getElementById('text_NN_options_${label_type}_${label_name}').value=unescape('${escape(nn_default_options_cats)}')" class="w3-button w3-tiny">Default Options</button>

                            <a href="https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers"> References </a> 

                            <div class="w3-row w3-left-align">
                                <textarea name="text_NN_options_${label_type}_${label_name}" id="text_NN_options_${label_type}_${label_name}" cols="10" rows="25" class="w3-input w3-dark-input" style="font-family: 'Courier New', Courier, monospace; max-height:300px;">${((models_cats!==null)&&(models_cats[db_id]!==null)&&(models_cats[db_id][label_name])) ? JSON.stringify(models_cats[db_id][label_name].options): nn_default_options_cats}</textarea>
                            </div>
                        </div>
                        

                        <div class="w3-row-padding w3-theme-d2 w3-left-align w3-small">
                            <div class="w3-third">
                                <label for="epochs">Epochs</label>
                                <input class="w3-input w3-dark-input w3-margin-right" type="number" id="epochs_${label_type}_${label_name}" placeholder="10" value="10">
                            </div>
                            <div class="w3-third">
                                <label for="batch">Batch size</label>
                                <input class="w3-input w3-dark-input" type="number" id="batch_${label_type}_${label_name}" placeholder="10" value="10">
                            </div>
                            <div class="w3-third">
                            <span>DB ID: ${db_id}</span>
                            </div>
                        </div> 

                        <div class="w3-container  w3-theme-d1 w3-padding">

                        <button class="w3-button w3-left w3-blue-grey w3-border w3-round-large w3-margin-left" onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'">Close</button>

                            <button class="w3-button w3-left w3-teal w3-border w3-round-large w3-margin-right"
                            onclick="SA.start_nn_training('${label_type}', '${label_name}')">Start Training</button>

                        </div>
                    </div>
                </div>`;
            }
        }

        for (let y_ord=0; y_ord<label_heads_ord.length; y_ord++)
        {
            const label_type = label_types.ord;
            
            if(label_heads_ord[y_ord]!=null)
            {
            const label_name = label_heads_ord[y_ord];
            thtml += `<div class="w3-cell w3-border w3-border-blue" style="width:100px; margin-left:10px; display: inline-block;">
                        <h5>${label_name}</h5>
                        <div class="w3-row w3-margin-top">
                        <button onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='block'" class="w3-button w3-tiny w3-border w3-border-indigo">Model</button>
                        </div>
                        <div class="w3-row w3-margin-top">
                            <button onclick="SA.start_nn_prediction('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom" id="pred_${label_type}_${label_name}" disabled>Predict</button>
                        </div>
                    </div>`;

      
            //Train settings modals
            thtml_m += `<div id="nn_train_modal_${label_type}_${label_name}" class="w3-modal w3-animate-opacity">
                    <div class="w3-modal-content w3-card-4 w3-animate-zoom">

                        <header class="w3-container w3-theme-d1"> 
                        <span onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'" 
                        class="w3-button w3-red w3-xlarge w3-display-topright">&times;</span>
                        <h2>Regression NN for ${label_name}</h2>
                        </header>

                        <div class="w3-container w3-theme-d2 w3-small w3-left-align">
                            <div class="w3-row w3-padding-small ">
                                
                                <p>Download the trained model or load a pre-trained model</p>
                                    
                                <div class="w3-col m2">
                                    <button onclick="SA.download_nn_model('${label_type}','${label_name}')" class="w3-button w3-tiny w3-border w3-indigo">Download Model</button>
                                </div>

                                <div class="w3-col m2">
                                <input type="file" id="nn_mod${label_type}_${label_name}" name="nn_${label_type}_${label_name}[]" onchange="SA.load_files_nn_model(this.files, '${label_type}', '${label_name}')" multiple="" class="w3-button w3-hover-border-khaki w3-padding"/>

                                </div>
                            </div>
                            <h6>Model training options</h6>

                            <button onclick="document.getElementById('text_NN_options_${label_type}_${label_name}').value=unescape('${escape(nn_default_options_ords)}')" class="w3-button w3-tiny">Default Options</button>

                            <a href="https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers"> References </a> 

                            <div class="w3-row w3-left-align">
                                <textarea name="text_NN_options_${label_type}_${label_name}" id="text_NN_options_${label_type}_${label_name}" cols="10" rows="25" class="w3-input w3-dark-input" style="font-family: 'Courier New', Courier, monospace; max-height:300px;">${((models_ords!==null)&&(models_ords[db_id]!==null)&&(models_ords[db_id][label_name])) ? JSON.stringify(models_ords[db_id][label_name].options): nn_default_options_ords}</textarea>
                            </div>
                        </div>
                        

                        <div class="w3-row-padding w3-theme-d2 w3-left-align w3-small">
                            <div class="w3-third">
                                <label for="epochs">Epochs</label>
                                <input class="w3-input w3-dark-input w3-margin-right" type="number" id="epochs_${label_type}_${label_name}" placeholder="10" value="10">
                            </div>
                            <div class="w3-third">
                                <label for="batch">Batch size</label>
                                <input class="w3-input w3-dark-input" type="number" id="batch_${label_type}_${label_name}" placeholder="10" value="10">
                            </div>
                            
                            <div class="w3-third">
                            <span>DB ID: ${db_id}</span>
                            </div>
                        </div> 

                        <div class="w3-container  w3-theme-d1 w3-padding">

                        <button class="w3-button w3-left w3-blue-grey w3-border w3-round-large w3-margin-left" onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'">Close</button>

                            <button class="w3-button w3-left w3-teal w3-border w3-round-large w3-margin-right"
                            onclick="SA.start_nn_training('${label_type}', '${label_name}')">Start Training</button>

                        </div>
                    </div>
                </div>`;
            }
        }
        document.getElementById("ML_training_div").innerHTML += thtml;
        document.getElementById("ML_training_div_modals").innerHTML = thtml_m;
        thtml = null;
        thtml_m = null;

        for (let y_cat=0; y_cat < label_heads_cat.length; y_cat++)
        {
            const label_type = label_types.cat;
            if(aux.isObject(label_heads_cat[y_cat]))
            {
                const label_name = Object.keys(label_heads_cat[y_cat])[0];

                
                if(label_name=='emotion')   //only for emotion - debug
                {
                    const model_link = models_dir+db_id+'/'+label_type+'_'+label_name+'/model.json';
                    load_single_nn(label_type, label_name, false, null, model_link).then(function()
                    {

                    }).catch((err)=>{
                    
                        console.error(err);
                        document.getElementById('nn_msg').textContent = err;
                        
                    });
                }
            }
        }

    }
    }
    else
    {
        document.getElementById("ML_training_div").innerHTML = "";
    }
}

*/





