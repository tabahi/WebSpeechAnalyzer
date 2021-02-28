

const storage_mod = require('./localstore.js');
const enable_training_div = true;

const expected_features_N = 40;

console.log('ml5 version:', ml5.version);
//https://learn.ml5js.org/#/reference/neural-network

//var nn_models = null;
var models_cats = null;
var models_ords = null;
const label_types = {cat: "cats", ord: "ords"};




export async function load_all_nn(callback_after=null)  //not used
{
    //loads all nn models

    return new Promise((resolve, reject)=>{
        let label_heads = storage_mod.get_label_heads();
        if((label_heads) && (nn_models) && (Object.keys(nn_models).length >= label_cats.length) ) //needs fix
        {
            console.log("Models already loaded");
            resolve(1);
        }
        else
        {
            document.getElementById('nn_msg').textContent = "Loading default models...";
            recheck_label_cats();
            if((label_cats) && (label_cats.length>0)) //not null
            {
                let single_load_promises = [];
                for(let ln=0; ln<label_cats.length; ln++)
                {
                    single_load_promises[ln] = load_single_nn(label_cats[ln], true);
                }

                Promise.all(single_load_promises).
                then(function(){
                    document.getElementById('nn_msg').textContent = "Default models loaded: " + String(Object.keys(nn_models).length);
                    console.log("All NN models loaded");
                    resolve(1);
                    if(callback_after) callback_after();
                }).catch((err)=>{

                    document.getElementById('nn_msg').textContent = "ERROR: models loading failed: " + String(Object.keys(nn_models).length);
                    console.error(err);
                    reject(err);
                });
                
            }
            else
            {
                reject("Labels not loaded yet"); 
            }
        }
       });
}


export function load_single_nn(label_type, label_name, reload=false, load_files=null, load_link=null)
{
    return new Promise((resolve, reject)=>{
        

        if((reload==false) && (((label_type==label_types.cat) && (models_cats) && models_cats[label_name] && (models_cats[label_name].ready)) ||
                                ((label_type==label_types.ord) && (models_ords) && models_ords[label_name] && (models_ords[label_name].ready))))
        {
            console.log("Model ready\t" + label_name);
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
                    if(models_cats==null) models_cats = {};
                    models_cats[label_name] = loaded_model;   //set to global after successfully loaded
                }
                else if(label_type==label_types.ord)
                {
                    if(models_ords==null) models_ords = {};
                    models_ords[label_name] = loaded_model;
                }
                success_load = true;
                resolve(1);
                if(load_files)
                {
                    make_ML_div(true);
                    document.getElementById('nn_msg').textContent = "Model loaded from files for " + label_name;
                    document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
                }
                else
                {
                    make_ML_div(true);
                    document.getElementById('nn_msg').textContent = "Model loaded from web for " + label_name;
                    document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
                }
            }
            console.log("Loading model for " + label_name);
            if(load_files)
            {
                if(load_files.length != 3)
                {
                    alert("Please load the 3 files of model, model_meta and weights bin");
                    reject(0);
                }
                else
                {
                    loaded_model.load(load_files, modelLoadedCallback);
                }
            }
            else if(load_link)
            {
                //'../../app_assets/dist/nnmodel/'+label_type+'_'+label_name+'/model.json'
                loaded_model.load(load_link, modelLoadedCallback);
            }
            else
            {
                reject("No model available to load");
            }
            
            setTimeout(function(){
                { loaded_model = null; if(!success_load) reject("Error while loading model for " + String(label_name)); }
            }, 2000);
        }
       });
}



export function train_nn(db_id, label_type, label_name)
{
    // Step 1: load data or create some data 
    //let label_name = 'A';
    //console.log(document.getElementById('text_NN_options_' + label_name).value);
    
    let options = JSON.parse(document.getElementById('text_NN_options_' + label_type +'_'+ label_name).value);
    if(isObject(options)==false) {alert("Invalid syntax"); return}
    document.getElementById('nn_train_modal_' + label_type +'_'+ label_name).style.display='none';
    
    let epochs_ = parseInt(document.getElementById('epochs_' + label_type +'_'+ label_name).value); if(epochs_ < 1) epochs_ = 10;
    let batchSize_ = parseInt(document.getElementById('batch_' + label_type +'_'+ label_name).value); if(batchSize_ < 1) batchSize_ = 10;

    document.getElementById('nn_msg').textContent = "Processing data for training for label " + label_name;
    let train_data = storage_mod.collect_db_data(db_id);

    if(train_data)
    {
        const balance = true;
        // Step 2: set your neural network options
        /*
        let options = {
            task: 'regression',
            inputs: expected_features_N,
            outputs: 1,
            debug: true,
            learningRate: 0.2,
            layers:[
                {
                  type: 'dense',
                  units: 64,
                  activation: 'sigmoid',
                },
                {
                  type: 'dense',
                  units: 16,
                  activation: 'sigmoid',
                },
                {
                  type: 'dense',
                  activation: 'sigmoid',
                },
              ]
        };*/
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

            function add_data(data_i, check_label=null)
            {
                if( train_data[4][data_i] && (isObject(train_data[4][data_i][0])) && (train_data[4][data_i][0][label_] != null) )
                {
                    const label_index = label_classes.indexOf(train_data[4][data_i][0][label_]);
                    const label_index_any = label_classes.indexOf('*');
                    if(((label_index>=0) || (label_index_any>=0)) && ((check_label==null) || (label_index==check_label)))
                    {
                        let this_out = train_data[4][data_i][0][label_name];
                        
                        const output = {y: String(this_out)};   //doesn't work without String
                        
                        const input = train_data[2][data_i];
                        new_nn_model.addData(input, output);
                        if(check_label==null) sample_count++;
                        if(label_index>=0) count_n[label_index]++;
                    }
                }
            }

            for (let i=0; i<data_len; i++) 
            {
                add_data(i);
            }
            
            console.log("Samples: " + String(count_n));

            if(sample_count<10) 
            {
                document.getElementById('nn_msg').textContent = "Sample size "+String(sample_count)+"/"+ String(data_len)+" too small for training";
                return;
            }
            
            if(balance)
            {
                const max_n = arrayMax(count_n);
                if(max_n > 0)
                for(let cl=0; cl < label_classes.length; cl++)
                {
                    while((count_n[cl]<max_n) && (count_n[cl] > 10))
                    for (let i=0; i<data_len; i++) 
                    {
                        if(count_n[cl]<max_n) add_data(i, cl);
                        if(count_n[cl]>=max_n) break;
                    }
                }
            }
            

            console.log("Balanced: " + String(count_n));
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
            
            function add_data(data_i, add_zero=true)
            {
                if( train_data[4][data_i] && (isObject(train_data[4][data_i][1])) && (train_data[4][data_i][1][label_] != null) )
                {
                    if((add_zero) || (train_data[4][data_i][1][label_] !=0 ))
                    {
                        let this_out = train_data[4][data_i][1][label_];
                        
                        const output = {y: this_out};
                        
                        const input = train_data[2][data_i];
                        new_nn_model.addData(input, output);
                        //console.log(output);
                        sample_count++;
                    }
                }
            }

            for (let i=0; i<data_len; i++) 
            {
                add_data(i);
            }
            
            console.log("Samples: " + String(sample_count));

            if(sample_count<10) 
            {
                document.getElementById('nn_msg').textContent = "Sample size "+String(sample_count)+"/"+ String(data_len)+" too small for training";
                return;
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
                if(!models_cats) models_cats = {};
                models_cats[label_name] = null;
                models_cats[label_name] = new_nn_model;

                document.getElementById('nn_msg').textContent = "Finished training. New model is loaded for label: " + label_name;
                document.getElementById('pred_' + label_type + '_' + label_name).disabled = false;
            }
            else if(label_type==label_types.ord)
            {
                if(!models_ords) models_ords = {};
                models_ords[label_name] = null;
                models_ords[label_name] = new_nn_model;

                document.getElementById('nn_msg').textContent = "Finished training. New model is loaded for label: " + label_name;

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




function arrayMax(arr) {
    let len = arr.length, max = -Infinity;
    while (len--) {
      if (arr[len] > max) {
        max = arr[len];
      }
    }
    return max;
};



export async function predict_db_nn(db_id, label_type, label_name)
{

    let test_data = storage_mod.collect_db_data(db_id);

    console.log('predict_db_nn' + '\t' + label_type + '\t' + label_name);
    load_single_nn(label_type, label_name, false).then(function()
    {
        
        if (((label_type==label_types.cat) && (models_cats[label_name].ready)) || ((label_type==label_types.ord) && (models_ords[label_name].ready)))
        {
            if(test_data)
            {
                if (label_type==label_types.cat) console.log(models_cats[label_name].options);
                else if(label_type==label_types.ord) console.log(models_ords[label_name].options);

                document.getElementById('nn_msg').textContent = "Predicting label " + label_name;
                

                for (let i=0; i<test_data[0].length; i++) 
                {
                    const test_input = test_data[2][i];
                    const handleResults = function(error_out, result_out) { 
                        nn_db_results_handler(error_out, result_out, label_type, label_name, test_data[0][i]); //last arg is seg_key
                    }; //pass the seg_key

                    if (label_type==label_types.cat)
                        models_cats[label_name].classify(test_input, handleResults);
                    else if(label_type==label_types.ord)
                        models_ords[label_name].predict(test_input, handleResults);
                        
                }

                function after_finish_prediction()
                {
                    document.getElementById('nn_msg').textContent = "Finished prediction of " + String(label_name);
                    storage_mod.shows_stats_table(null, db_id);
                    //storage_mod.Refresh_Table(db_id);
                }
                
                window.setTimeout(after_finish_prediction, 500);

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


function nn_db_results_handler(error_out, result_out, label_type, label_name, seg_key)
{
    if(error_out)
    {
        console.error(error_out);
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
            storage_mod.update_pred_label(seg_key, label_name, top_label);
        }
        else if(label_type == label_types.ord)
        {
            storage_mod.update_pred_label(seg_key, label_name, result_out[0].value);
        }
    }

}




export function predict_seg_nn(raw_in, callback_func)
{
    if((nn_loaded > 0) && (nn_model.ready))
    {
        if(raw_in)
        {
            const test_input = make_features_obj(raw_in);
            const handleResults = function(error_out, result_out) { seg_results_handler(error_out, result_out, callback_func); };
            //pass the si
            nn_model.classify(test_input, handleResults);
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
    
}


function seg_results_handler(error_out, result_out, callback_func)
{
    if(error_out)
    {
        console.error(error_out);
        document.getElementById('nn_msg').innerHTML += "  ERROR: " + error_out + '. <br>';
    }
    if((result_out) && (callback_func))
    callback_func(result_out);
    /*
    let conf_arr = new Array(label_cats.length).fill(0);
    if(result_out)
    {
        for(let yl=0; yl<result_out.length; yl++)
        {
            for(let el=0; el<label_cats.length; el++)
            {
                if(result_out[yl].label==label_cats[el])
                {
                    conf_arr[el] = result_out[yl].confidence;
                    break;
                }
            }
        }
    }
    return conf_arr;    //confidence array
    */
}




export function download_nn_model(label_type, label_name)
{
    function after_nn_export()
    {
        document.getElementById('nn_msg').textContent = "Model download started for " + label_name;
    }
    
    if((label_type==label_types.cat) && (models_cats) && (models_cats[label_name]))
    {
        models_cats[label_name].save("model", after_nn_export);
    } 
    else if((label_type==label_types.ord) && (models_ords) && (models_ords[label_name]))
    {
        models_ords[label_name].save("model", after_nn_export);
    }
    else
    {
        document.getElementById('nn_msg').textContent = "ML model is not loaded or trained yet for " + label_name;
    }
}





function make_features_obj(features)
{
    //create an object from freature's array
    let features_json = "{";
    for (let x=0; x<expected_features_N; x++)
    {
        features_json += "\"x" + String(x) + "\": " + String(features[x]);
        if(x < expected_features_N-1) features_json+= ", ";
    }
    features_json+= "}";
    features_json = JSON.parse(features_json);
    //features_json = features;
    return features_json;
}



export function make_ML_div(enable_disable)
{
    //recheck_label_cats();

    if(enable_disable)
    {

    let label_heads = storage_mod.get_label_heads();
    
    if((enable_training_div) && (label_heads) && (label_heads.length>=2))
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
            
            if(isObject(label_heads_cat[y_cat]))
            {
            const label_name = Object.keys(label_heads_cat[y_cat])[0];
            thtml += `<div class="w3-cell w3-border w3-border-lime" style="width:100px; margin-left:10px; display: inline-block;">
                        <h5>${label_name}</h5>
                        <div class="w3-row w3-margin-top">
                        <button onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='block'" class="w3-button w3-tiny w3-border w3-border-indigo">Model</button>
                        </div>
                        <div class="w3-row w3-margin-top">
                            <button onclick="FASER.start_nn_prediction('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom"  id="pred_${label_type}_${label_name}" disabled>Predict</button>
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
                                    <button onclick="FASER.download_nn_model('${label_type}','${label_name}')" class="w3-button w3-tiny w3-border w3-indigo">Download Model</button>
                                </div>

                                <div class="w3-col m2">
                                <input type="file" id="nn_mod${label_type}_${label_name}" name="nn_${label_type}_${label_name}[]" onchange="FASER.load_files_nn_model(this.files, '${label_type}', '${label_name}')" multiple="" class="w3-button w3-hover-border-khaki w3-padding"/>

                                </div>
                            </div>
                            <h6>Model training options</h6>
                            <a href="https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers"> References </a> 
                            
                            <div class="w3-row w3-left-align">
                                <textarea name="text_NN_options_${label_type}_${label_name}" id="text_NN_options_${label_type}_${label_name}" cols="10" rows="25" class="w3-input w3-dark-input" style="font-family: 'Courier New', Courier, monospace; max-height:300px;">${((models_cats!==null)&&(models_cats[label_name])) ? JSON.stringify(models_cats[label_name].options): nn_default_options_cats}</textarea>
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
                        </div> 

                        <div class="w3-container  w3-theme-d1 w3-padding">

                        <button class="w3-button w3-left w3-blue-grey w3-border w3-round-large w3-margin-left" onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'">Close</button>

                            <button class="w3-button w3-left w3-teal w3-border w3-round-large w3-margin-right"
                            onclick="FASER.start_nn_training('${label_type}', '${label_name}')">Start Training</button>

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
                            <button onclick="FASER.start_nn_prediction('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom" id="pred_${label_type}_${label_name}" disabled>Predict</button>
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
                                    <button onclick="FASER.download_nn_model('${label_type}','${label_name}')" class="w3-button w3-tiny w3-border w3-indigo">Download Model</button>
                                </div>

                                <div class="w3-col m2">
                                <input type="file" id="nn_mod${label_type}_${label_name}" name="nn_${label_type}_${label_name}[]" onchange="FASER.load_files_nn_model(this.files, '${label_type}', '${label_name}')" multiple="" class="w3-button w3-hover-border-khaki w3-padding"/>

                                </div>
                            </div>
                            <h6>Model training options</h6>
                            <div class="w3-row w3-left-align">
                                <textarea name="text_NN_options_${label_type}_${label_name}" id="text_NN_options_${label_type}_${label_name}" cols="10" rows="25" class="w3-input w3-dark-input" style="font-family: 'Courier New', Courier, monospace; max-height:300px;">${((models_ords!==null)&&(models_ords[label_name])) ? JSON.stringify(models_ords[label_name].options): nn_default_options_ords}</textarea>
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
                        </div> 

                        <div class="w3-container  w3-theme-d1 w3-padding">

                        <button class="w3-button w3-left w3-blue-grey w3-border w3-round-large w3-margin-left" onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'">Close</button>

                            <button class="w3-button w3-left w3-teal w3-border w3-round-large w3-margin-right"
                            onclick="FASER.start_nn_training('${label_type}', '${label_name}')">Start Training</button>

                        </div>
                    </div>
                </div>`;
            }
        }
        document.getElementById("ML_training_div").innerHTML += thtml;
        document.getElementById("ML_training_div_modals").innerHTML = thtml_m;
        thtml = null;
        thtml_m = null;

    }
    }
    else
    {
        document.getElementById("ML_training_div").innerHTML = "";
    }
}




function isObject(objValue) {
    return objValue && typeof objValue === 'object' && objValue.constructor === Object;
  }




const nn_default_options_cats = `{
    "task": "classification",
    "inputs": ${expected_features_N},
    "outputs": 1,
    "learningRate": 0.2,
    "debug": true,
    "layers":
    [
        {
            "type": "dense",
            "units": 128,
            "kernel_regularizer": "l2",
            "activation": "relu"
        },
        {
            "type": "dense",
            "units": 64,
            "activation": "relu"
        },
        {
            "type": "dense",
            "units": 16,
            "activation": "relu"
        },
        {
            "type": "dense",
            "activation": "softmax"
        }
    ]
}`;


const nn_default_options_ords = `{
    "task": "regression",
    "inputs": ${expected_features_N},
    "outputs": 1,
    "learningRate": 0.2,
    "debug": true,
    "layers":
    [
        {
            "type": "dense",
            "units": 64,
            "activation": "sigmoid"
        },
        {
            "type": "dense",
            "units": 16,
            "activation": "sigmoid"
        },
        {
            "type": "dense",
            "activation": "sigmoid"
        }
    ]
}`;

