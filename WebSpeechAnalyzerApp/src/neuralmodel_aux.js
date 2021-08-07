//auxillary functions

const expected_features_N = 53;

export function domain_avg_collector(features)
{
    //console.log(features.length);
}


export function isObject(objValue) {
    return objValue && typeof objValue === 'object' && objValue.constructor === Object;
  }


export function build_ML_box(db_id, label_type, label_name, border_color='gray')
{
    return `<div class="w3-cell w3-border w3-border-${border_color}" style="width:100px; margin-left:10px; display: inline-block;">
                <h5>${label_name}</h5>
                <div class="w3-row w3-margin-top">
                <button onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='block'" class="w3-button w3-tiny w3-border w3-border-indigo">Model</button>
                </div>
                <div class="w3-row w3-margin-top">
                    <button onclick="SA.start_nn_prediction('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom" id="pred_${label_type}_${label_name}" disabled>Predict</button>
                </div>
            </div>`;    //remove this last </div> when including KNN buttons
                //KNN buttons are disabled:
                /*
                <div class="w3-row w3-margin-top">
                    <button onclick="SA.start_knn_training('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom" id="train_knn_${label_type}_${label_name}">KNN Train</button>
                </div>
                <div class="w3-row w3-margin-top">
                    <button onclick="SA.start_knn_prediction('${label_type}', '${label_name}')" class="w3-button w3-tiny w3-border w3-border-indigo w3-margin-bottom" id="pred_${label_type}_${label_name}" disabled>Predict</button>
                </div>

            </div>`;*/
}

export function build_ML_modal(db_id, label_type, label_name, model_options, default_options)
{
    
    //Train settings modals
    return `<div id="nn_train_modal_${label_type}_${label_name}" class="w3-modal w3-animate-opacity">
            <div class="w3-modal-content w3-card-4 w3-animate-zoom">

                <header class="w3-container w3-theme-d1"> 
                <span onclick="document.getElementById('nn_train_modal_${label_type}_${label_name}').style.display='none'" 
                class="w3-button w3-red w3-xlarge w3-display-topright">&times;</span>
                <h2>${label_type} NN model for ${label_name}</h2>
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

                    <button onclick="document.getElementById('text_NN_options_${label_type}_${label_name}').value=unescape('${escape(default_options)}')" class="w3-button w3-tiny">Default Options</button>

                    <a href="https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers"> References </a> 

                    <div class="w3-row w3-left-align">
                        <textarea name="text_NN_options_${label_type}_${label_name}" id="text_NN_options_${label_type}_${label_name}" cols="10" rows="25" class="w3-input w3-dark-input" style="font-family: 'Courier New', Courier, monospace; max-height:300px;">${model_options}</textarea>
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


export const nn_default_options_cats = `{
    "task": "classification",
    "inputs": ${expected_features_N},
    "outputs": 1,
    "learningRate": 0.2,
    "debug": true,
    "layers":
    [
        {
            "type": "dense",
            "units": 8,
            "activation": "relu"
        },
        {
            "type": "dense",
            "activation": "softmax"
        }
    ]
}`;


export const nn_default_options_ords = `{
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



/*
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
}*/


