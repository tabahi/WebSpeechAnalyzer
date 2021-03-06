/*build cmd:

cd app_assets
npm run build

*/

const AudioLauncher = require('./FormantAnalyzer/AudioLauncher.js');
const storage_mod = require('./localstore.js');  //forwards extracted features to a storage module (see call_backed)
const labeling_mod = require('./labeling.js');
const nn_mod = require('./neuralmodel.js');

const CANVAS_CTX = document.querySelector('#SpectrumCanvas').getContext('2d');
const BOX_WIDTH = 1200;
const BOX_HEIGHT = 400;

//var settings = { offline:true, plot_enable:true, spec_type: 1, process_level: 4, plot_len: 200, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pause_length:500, min_seg_length:150, plot_lag:1, pre_norm_gain: 1000, high_f_emph:0.00, slow:true, DB_ID:1, collect:true};
var settings = { offline:false, plot_enable:true, spec_type: 1, process_level: 5, plot_len: 300, f_min: 50, f_max: 4000, N_fft_bins: 256, N_mel_bins: 128, window_width: 25, window_step: 25, pause_length:200, min_seg_length:50, plot_lag:1, pre_norm_gain: 1000, high_f_emph:0.00, slow:true, DB_ID:1, collect:false, ML_en: false};

var status = { playing:false, files_processed:0, current_file_index:0, Source:1 };

var loaded_files = null;    //this holds the current files loaded in the drop zone


/*This function is called asynchronously after each segment or phoneme depending on the process level. si is the index of segment/phoneme out of all since reset*/
async function call_backed(si, seg_label, seg_time, incoming)
{
    if(settings.collect)
    if(settings.process_level == 7)
    {

        if(seg_time.length != incoming.length) console.error("Length mismatch");

        for(let ph = 0; ph < incoming.length; ph++ ) 
        {
            storage_mod.StoreFeatures(settings.process_level, settings.DB_ID, (si + (ph/100)), seg_label, seg_time[ph], incoming[ph]);
        }
    }
    else if(settings.process_level == 6) //this function is specifically for labeling phonemes
    {
        if(seg_time.length != incoming.length) console.error("Length mismatch");

        for(let ph = 0; ph < incoming.length; ph++ ) 
        {
            storage_mod.StoreFeatures(settings.process_level, settings.DB_ID, (si + (ph/100)), seg_label, seg_time[ph], incoming[ph]);
        }
        //let this_filename = seg_label[0];
    }
    else if(settings.process_level == 5)
    {
        storage_mod.StoreFeatures(settings.process_level, settings.DB_ID, si, seg_label, seg_time, incoming);
        //else
        //handle_prediction(si, incoming);
    }
    else if(settings.process_level == 4)
    {
        storage_mod.StoreFeatures(settings.process_level, settings.DB_ID, si, seg_label, seg_time, incoming);

        
        //else
        //handle_prediction(si, incoming);
    }
    return;
}


async function handle_prediction(si, incoming) //not used
{
    
    function call_back_after_pred(result_out)
    {
        let max_label = 0, max_confidence = 0;
        for (let pl=0; pl<result_out.length; pl++)
        {
            if(result_out[pl].confidence > max_confidence)
            {
                max_confidence = result_out[pl].confidence;
                max_label = result_out[pl].label;
            }
        }
        
        AudioLauncher.set_predicted_label_for_segment(si, 1, [max_label, max_confidence]);
        //console.log(si + '\t' + String([max_label, max_confidence]));
    };

    nn_mod.predict_seg_nn(incoming, call_back_after_pred);  //call nn classify

}


export function refresh_db_table()
{
    storage_mod.Refresh_Table(settings.DB_ID, settings.collect);
    nn_mod.make_ML_div(settings.ML_en);
    
    document.getElementById('db_settings_model').style.display='none';
}



export function clear_db_table()
{
    if(confirm("Clear all the stored data?"))
    {
        storage_mod.clear_db_store();
        refresh_db_table();
        console.log("Data cleared");
    }
}

export function download_db_table()
{
    storage_mod.Download_DB_JSON(settings.DB_ID);
}



export function start_nn_training(label_type, label_name)
{
    nn_mod.train_nn(settings.DB_ID, label_type, label_name);
}


export function start_nn_prediction(label_type, label_name)
{
    nn_mod.predict_db_nn(settings.DB_ID, label_type, label_name);
}

export function download_nn_model(label_type, label_name)
{
    nn_mod.download_nn_model(label_type, label_name);
}

export function load_files_nn_model(filex348, label_type, label_name)
{
    nn_mod.load_single_nn(label_type, label_name, true, filex348, null);    //or send the last argument to load from a web link instead of files
}

export function dx_label(seg_id, label, new_val)
{
    storage_mod.update_true_label(seg_id, label, new_val);
}

export function clear_labels(clear_true=true, clear_pred=true)
{
    storage_mod.clear_labels(settings.DB_ID, clear_true, clear_pred);
}


export function play_file_sample(filename, play_offset=null, play_duration=null, test_mode=true, call_backed=null)
{
    
    //play a single file with offset and duration in seconds
    //Find in the index of file in the loaded files
    if(! loaded_files) { alert("First load the selected file in the drop zone."); return false; }
    let pos =  -1;
    for(var i = 0, len = loaded_files.length; i < len; i++) {
        if (loaded_files[i].name === filename) {
            pos = i;
            break;
        }
    }
    if(pos<0)
    {
        alert("File not loaded in the drop zone:\t"+ String(filename));
        
        return false;
    }
    if(status.playing)
    {
        
        stop_playing("New file play");
        status.Source = 1;
    }
    
    status.current_file_index = pos;
    let reader = new FileReader();
    
    reader.onload = function(e) 
    {
        let this_file_name = loaded_files[status.current_file_index].name;
        let mimeType= loaded_files[status.current_file_index].type;
        if(mimeType.includes("audio/") || mimeType.includes("video/"))
        {
            //let this_file_bin = e.target.result;
            document.getElementById('msg').textContent = "Playing file " + String(status.current_file_index+1) + "/" + String(loaded_files.length);
            
            ConfigureLauncher();
            status.playing = true;
            AudioLauncher.LaunchAudioNodes(e.target.result, call_backed, [this_file_name], false, 1, test_mode, play_offset, play_duration).then(function()
            {
                stop_playing("Finished processing sample");
                document.getElementById('msg').textContent = "Finished playing: " + String(this_file_name);
                e = null;
                reader = null;
                return true;
                
            }).catch((err)=>{
                console.log(err);
                stop_playing("Error during play start");
                document.getElementById('msg').textContent = "Error playing: " + String(this_file_name);
                return false;
            });
        }
        else
        {
            document.getElementById('msg').textContent = "Invalid format: " + String(this_file_name) + ", " + String(mimeType);
            return false;
        }
    }
    reader.readAsArrayBuffer(loaded_files[status.current_file_index]);  //read binary of audio file
    return true;
}



function PlayNextFile() //play the files loaded in drop zone queue
{
    //This function plays all the loaded files. After each file it calls 'finished_file_play()', which recursively calls this function again until it reaches the end
    if(status.current_file_index >= loaded_files.length)
        return false;

    let reader = new FileReader();
    //let this_file = loaded_files[status.current_file_index];
    
    reader.onload = function(e) 
    {
        let this_file_name = loaded_files[status.current_file_index].name;
        if((settings.collect) && (settings.offline) && (storage_mod.if_file_in_db(settings.DB_ID, this_file_name)))
        {
            document.getElementById('msg').textContent = "Skipping file " + String(status.current_file_index+1) + "/" + String(loaded_files.length);
            finished_file_play();
            return true;
        }
        let mimeType= loaded_files[status.current_file_index].type;

        if(mimeType.includes("audio/") || mimeType.includes("video/"))
        {
            //let this_file_bin = e.target.result;
            document.getElementById('msg').textContent = "Playing file " + String(status.current_file_index+1) + "/" + String(loaded_files.length);

            AudioLauncher.LaunchAudioNodes(e.target.result, call_backed, [this_file_name], settings.offline, 1, false, null, null).then(function()
            {
                e = null;   //clear memory
                reader = null;
                finished_file_play();
                return true;
            }).catch((err)=>{
                console.log(err);
                stop_playing("Error during play start");
                document.getElementById('msg').textContent = "Error playing: " + String(this_file_name);
                return false;
            });
        }
        else
        {
            document.getElementById('msg').textContent = "Invalid format: " + String(this_file_name) + ", " + String(mimeType);
            return false;
        } 
    }
    reader.readAsArrayBuffer(loaded_files[status.current_file_index]);  //read binary of audio file
    return true;
}




function finished_file_play()   //it called after the LaunchAudioNodes returns a successful promise, in context_source=1 mode.
{
    status.files_processed++;
    if(status.files_processed<loaded_files.length)
    {
        if(status.playing)
        {
            status.current_file_index++    
            
            //A delay between files play prevents the RAM overload by giving the JS engine rest time to clear out null variables
            if(status.current_file_index<loaded_files.length)  //If there are more files to play
            {
                console.log("Next file: " + String(status.current_file_index));
                let next_file_tout = 10;
                
                if(status.current_file_index%100 == 0)
                    next_file_tout = 2000;
                else if(status.current_file_index%30 == 0)
                    next_file_tout = 1000;
                else if(status.current_file_index%10 == 0)
                    next_file_tout = 50;
                else if(status.current_file_index%5 == 0)
                    next_file_tout = 20;
                next_file_tout *= (settings.slow) ? 10 : 1;
                
                setTimeout(PlayNextFile, next_file_tout);   //play the next file in queue after a moment.
            }
            //else console.log("Finished playing all files");
        }
    }
    else
    {
        stop_playing("Finished processing all files");
        document.getElementById('msg').textContent = "Finished playing " + String(status.files_processed) + " files";
        //refresh_db_table();
        
        window.setTimeout(refresh_db_table, 1000);

        //DownloadJSON();
        
        //analyze_collected_data();
    }
}



function ConfigureLauncher()
{
    /* Configure the Audio Launcher*/
    AudioLauncher.configure(settings.spec_type, settings.process_level, settings.f_min, settings.f_max, settings.N_fft_bins, settings.N_mel_bins, settings.window_width, settings.window_step, settings.pre_norm_gain, settings.high_f_emph, settings.pause_length, settings.min_seg_length, settings.plot_enable, settings.plot_len, settings.plot_lag, CANVAS_CTX, BOX_WIDTH, BOX_HEIGHT);
}


function stop_playing(reason)
{
    status.playing = false;
    AudioLauncher.StopAudioNodes(reason);
    document.getElementById("play_button").value = "Play";
    document.getElementById("demo_button").value = "Demo";
    document.getElementById("mic_button").value = "Mic";
    
    document.getElementById("demo_button").disabled = false;
    document.getElementById("play_button").disabled = false;
    document.getElementById("mic_button").disabled = false;
}

function play_web_audio(web_audio_url)
{
    if(status.Source!=2)
    {
        if(status.playing==false)
        {
            stop_playing("Source change");
            status.Source = 2;
        }
    }
    if(status.Source==2)
    {
        if(status.playing == false)
        {
            var webAudioElement = new Audio(web_audio_url);
            webAudioElement.crossOrigin = 'anonymous';
            document.getElementById('msg').textContent = "Loading audio...";

            function play_end_func()
            {
                stop_playing("Web play ended");
            }
            
            disable_buttons(true);
            document.getElementById("demo_button").value = "...";
            webAudioElement.addEventListener("canplaythrough", event => {

                webAudioElement.addEventListener("ended", play_end_func, false);
                /* the audio is now playable; play it if permissions allow */
                
                document.getElementById('msg').textContent = "Playing audio...";
                
                //webAudioElement.play(0);
                document.getElementById("demo_button").value = "Stop";
                document.getElementById("demo_button").disabled = false;
                status.playing = true;
                ConfigureLauncher();
                AudioLauncher.LaunchAudioNodes(webAudioElement, call_backed, ['demo'], false, 2, false).then(function()
                {
                    //status.playing = false;
                    //AudioNodes.disconnect_nodes("End file");
                    stop_playing("End Sop play");
                    document.getElementById('msg').textContent = "Finished playing";

                    
                }).catch((err)=>{
                    console.log(err);
                    stop_playing("Error during play start");
                    document.getElementById('msg').textContent = "Error playing";
                });
                
            });
        }
        else
        {
            stop_playing("Button pressed");
            document.getElementById('msg').textContent = "Stopped";
        }
    }
    else console.log("Invalid source parameter");
}

/* Button press event functions */
//var play_url = 'Haendel_Lascia_chi_o_pianga.mp4';
//var play_url = "https://raw.githubusercontent.com/tabahi/Mel-Spectrum-Analyzer/master/Haendel_Lascia_chi_o_pianga.mp4";
var play_url = '263771__shadowisp__rpg-female-protagonist-lines-2.wav';
document.querySelector('#demo_button').addEventListener('click', function(e) {
    e.preventDefault();
    
    //play_web_audio('Haendel_Lascia_chi_o_pianga.mp4');
    play_web_audio(play_url);
});


document.querySelector('#mic_button').addEventListener('click', function(e) {
    e.preventDefault();
    if(status.Source!=3)
    {
        if(status.playing==false)
        {
            stop_playing("Source change");
            status.Source = 3;
        }
    }
    if(status.Source==3)
    {
        if(status.playing == false)
        {
            document.getElementById('msg').textContent = "Streaming from mic...";
            
            disable_buttons(true);
            document.getElementById("mic_button").value = "...";
            
            
            document.getElementById("mic_button").value = "Stop";
            document.getElementById("mic_button").disabled = false;
            status.playing = true;
            ConfigureLauncher();
            AudioLauncher.LaunchAudioNodes(null, call_backed, ['mic'], false, 3, true, null, null).then(function()
            {
                stop_playing("End sop play");
                
            }).catch((err)=>{
                console.log(err);
                stop_playing("Error during play start");
                document.getElementById('msg').textContent = "Error streaming";
            });
            
        }
        else
        {
            stop_playing("Button pressed");
            document.getElementById('msg').textContent = "Stopped";
        }
    }
    else  console.log("Invalid source parameter");
    
});






document.querySelector('#play_button').addEventListener('click', function(e) {
    e.preventDefault();
    
    if(status.Source!=1)
    {
        if(status.playing==false)
        {
            stop_playing("Source change");
            status.Source = 1;
        }
    }
    if(status.Source==1)
    {
        if(status.playing)
        {
            stop_playing("Button pressed");
            document.getElementById('msg').textContent = "Stopped";
        }
        else
        {
            
            if(!loaded_files)
            {
                document.getElementById('msg').textContent = "No files selected to play";
            }
            else
            {
                disable_buttons(true);
                status.current_file_index = 0;
                status.files_processed = 0;
                if(PlayNextFile())
                {
                    status.playing = true;
                    document.getElementById("play_button").value = "Stop";
                    document.getElementById("play_button").disabled = false;
                    document.getElementById('msg').textContent = "Playing";
                }
            }
        }
    }
    else console.log("Invalid source parameter");
});



function disable_buttons(disable)
{
    document.getElementById("demo_button").disabled = disable;
    document.getElementById("play_button").disabled = disable;
    document.getElementById("mic_button").disabled = disable;
}


/* File loading functions */

export function readmultifiles(files) 
{
    if(status.playing) stop_playing("New file loaded");
    
    loaded_files = null;
    status.current_file_index = 0;
    status.files_processed = 0;
    loaded_files = files;
    document.getElementById('msg').textContent = "Total " + String(loaded_files.length) + " files loaded";
    
}

var handleDragOver = function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
}

var handleDrop = function(e) {
    e.preventDefault()
    e.stopPropagation()
    readmultifiles(e.dataTransfer.files);
}

function init_dnd() //initialize drop zone elements
{

    if (window.File && window.FileReader && window.FileList && window.Blob) {
        //All the File APIs are supported.
    } else {
        console.warn('The Drag and Drop File APIs are not fully supported in this browser.');
    }
    const dropzone_div = document.getElementById('dropZone');
    dropzone_div.addEventListener('drop', handleDrop, false);
    dropzone_div.addEventListener('dragover', handleDragOver, false);
}



document.getElementById("up_data_file").addEventListener("change", handleFileSelect_data, false);

document.getElementById("up_labels_file").addEventListener("change", handleFileSelect_labels, false);


function handleFileSelect_data(e) 
{

    let uploaded_file = e.target.files[0];

    var reader = new FileReader();

    // Closure to capture the file information.
    reader.onload = (function(theFile) {
        return function(e) {
            //window.localStorage.clear();
            storage_mod.Load_JSON_Data(settings.DB_ID, e.target.result);
            refresh_db_table();
            
        };
    })(uploaded_file);

    // Read in the image file as a data URL.
    reader.readAsText(uploaded_file);

}


function handleFileSelect_labels(e) 
{

    let uploaded_file = e.target.files[0];

    var reader = new FileReader();

    // Closure to capture the file information.
    reader.onload = (function(theFile) {
        return function(e) {
            
            labeling_mod.Load_JSON_Labels_file(e.target.result);
            refresh_db_table();
            
        };
    })(uploaded_file);

    // Read in the image file as a data URL.
    reader.readAsText(uploaded_file);

}

export function data_collect_en(check_en)
{
    settings.collect = check_en;
    document.getElementById("ML_train_en").disabled = !settings.collect;
    if(settings.collect==false)
    {
        document.getElementById("ML_train_en").checked = false;
        settings.ML_en = false;
    }
    
    refresh_db_table();

}

export function ML_train_en(check_en)
{
    settings.ML_en = check_en;
    
    nn_mod.make_ML_div( settings.ML_en);
}


/* Main page settings functions */

export function update_settings()
{

    settings.offline = document.getElementById("offline").checked;

    settings.spec_type = parseInt(document.getElementById("spec_type").value);
    settings.process_level = parseInt(document.getElementById("process_level").value);

    
    settings.plot_enable = document.getElementById("plot_enable").checked;
    settings.plot_len = parseInt(document.getElementById("plot_len").value);

    settings.f_min = parseInt(document.getElementById("f_min").value);  
    settings.f_max = parseInt(document.getElementById("f_max").value);  
    //if(settings.f_min >= settings.f_max) alert("Invalid frequency range. Make sure f_min is less than f_max.")

    settings.N_fft_bins = parseInt(document.getElementById("N_fft_bins").value); 
    settings.N_mel_bins = parseInt(document.getElementById("N_mel_bins").value); 
    settings.window_width = parseInt(document.getElementById("window_width").value); 
    settings.window_step = parseInt(document.getElementById("window_step").value); 
    settings.pause_length = parseInt(document.getElementById("pause_length").value); 
    settings.min_seg_length = parseInt(document.getElementById("min_seg_length").value); 
    settings.pre_norm_gain = parseInt(document.getElementById("pre_norm_gain").value);
    settings.high_f_emph = parseFloat(document.getElementById("high_f_emph").value);
    settings.plot_lag = parseInt(document.getElementById("plot_lag").value); 

    //settings checks:
    settings.f_min = settings.f_min < 0 ? 0 : settings.f_min;
    settings.f_max = settings.f_max < 20 ? 20 :settings.f_max;
    settings.f_max=settings.f_max>20000?20000:settings.f_max;
    settings.f_min = settings.f_min >= settings.f_max ? parseInt(settings.f_max / 4) : settings.f_min;
    settings.N_fft_bins = settings.N_fft_bins < 8 ? 8 : settings.N_fft_bins;
    settings.N_mel_bins = settings.N_mel_bins>settings.N_fft_bins?settings.N_fft_bins:settings.N_mel_bins;
    settings.N_mel_bins = settings.N_mel_bins<4?4:settings.N_mel_bins;
    settings.window_width = settings.window_width<5?5:settings.window_width;
    settings.window_width = settings.window_width>1000?1000:settings.window_width;
    settings.window_step = settings.window_step<5?5:settings.window_step;
    settings.window_step = settings.window_step>1000?1000:settings.window_step;
    settings.pause_length = settings.pause_length<(settings.window_step*2)?(settings.window_step*2):settings.pause_length;
    settings.min_seg_length = settings.min_seg_length<(settings.window_step*4)?(settings.window_step*4):settings.min_seg_length;
    settings.plot_lag = settings.plot_lag<0 ?0:settings.plot_lag;
    
    dom_settings();
    ConfigureLauncher();
    document.getElementById('settings_model').style.display='none';
    
    
    
    
    console.log(settings);

}

function dom_settings()
{
    
    settings.collect = document.getElementById("data_collect_en").checked;
    settings.ML_en = document.getElementById("ML_train_en").checked;
    document.getElementById("ML_train_en").disabled = !settings.collect;

    document.getElementById("offline").checked = settings.offline;

    document.getElementById("spec_type").value = settings.spec_type;
    document.getElementById("process_level").value = settings.process_level;
    
    document.getElementById("plot_enable").checked = settings.plot_enable;
    document.getElementById("plot_len").value = settings.plot_len;

    document.getElementById("f_min").value = settings.f_min;
    document.getElementById("f_max").value = settings.f_max;

    document.getElementById("N_fft_bins").value = settings.N_fft_bins;
    document.getElementById("N_mel_bins").value = settings.N_mel_bins;
    document.getElementById("window_width").value = settings.window_width;
    document.getElementById("window_step").value = settings.window_step;
    document.getElementById("pause_length").value = settings.pause_length;
    document.getElementById("min_seg_length").value = settings.min_seg_length;
    
    document.getElementById("pre_norm_gain").value = settings.pre_norm_gain;
    document.getElementById("high_f_emph").value = settings.high_f_emph;
    document.getElementById("plot_lag").value = settings.plot_lag;

    if(settings.plot_enable) document.getElementById('canvas_div').style.display='block';
    else document.getElementById('canvas_div').style.display='none';
}

function setup()
{
    dom_settings();
    
    init_dnd();
    ConfigureLauncher();
    document.getElementById("table_div").innerHTML = `<div class="w3-animate-fading">Loading...</div>`;
    setTimeout(refresh_db_table, 1000);
    
    
    console.log("Ready");
    disable_buttons(false);

    const url_params = new URLSearchParams(document.location.search.substring(1));
    if(url_params.has("mode"))
    {
        //set process level
        let new_mode = url_params.get("mode");
        if((new_mode>0) && (new_mode<=7)) settings.process_level = new_mode;
        dom_settings();
    }
    if(url_params.has("p"))
    {
        let ext_address = url_params.get("p");
        console.log("Playing external URL: " + (ext_address));
        play_url = ext_address;
        //play_web_audio(ext_address);
    }
    
}


function synth_test()
{
    var utterThis = new SpeechSynthesisUtterance("yooooooooooooooooo sup");
    var synth = window.speechSynthesis;
    synth.speak(utterThis);
}


window.onload = setup;

