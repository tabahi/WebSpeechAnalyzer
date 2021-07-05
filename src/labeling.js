
var loaded_labels = null;
let json_loaded = false;



export function Load_JSON_Labels_file(json_string)  //seg_key, key_ts, key_true, key_pred
{
    
    let new_data = JSON.parse(json_string);
    if(new_data)
    {
        if(new_data[0] && new_data[0].i)
        {
        loaded_labels = new_data
        const labels_n = loaded_labels.length;
        json_loaded = true;
        document.getElementById('msg').textContent = "Loaded " + String(labels_n)  + " labels from JSON";
        }
        else
        {
            alert("Invalid label file");
        }
    }
    return;
}


export function label_from_filename(filename) //called from localstore
{
    //custom function to extract labels from filename
    //specifically codes for emotion recognition, extracts labels of emo, A, V,D, and sex from loaded_labels (a formantted Json file)

    if(filename)
    {
        if(json_loaded)
        {
            let this_name = filename.split("#")[1];
            for(let i=0; i<loaded_labels.length;i++)
            {
                if(loaded_labels[i].i==this_name)
                {
                    
                    const label_cats = { emotion: loaded_labels[i].emo, sex: loaded_labels[i].sex, spkr: loaded_labels[i].spkr , U: loaded_labels[i].U, E: loaded_labels[i].E, R: loaded_labels[i].R };
                    const label_ords = { V: loaded_labels[i].V, A:loaded_labels[i].A , D: loaded_labels[i].D };
                    //return [loaded_labels[i][1], loaded_labels[i][2], loaded_labels[i][3], loaded_labels[i][4], loaded_labels[i][5]];
                    //console.log(label_obj);
                    return [label_cats, label_ords];
                }
            }
            console.log('Not found ' + this_name);
            return null;
        }
        else
        {
            //console.warn("Invalid filename, can't extract label from it.\t"+(filename));
            return null;
        }
    }
    else
    {
        console.error("Error: Filename is required to extract emo labels.");
        return null;
    }
}



function load_json_labels_web() //not used
{
        
    const parse_DB_json = './dist/emo_labels/IEMOCAP_000000_index_list_2943.json';
    //const parse_DB_json = './dist/emo_labels/MSP_000000_index_list.json';
    //const parse_DB_json = './dist/emo_labels/RAVDESS_000000_index_list.json';

    return new Promise((resolve, reject)=>{
         if(!json_loaded) {
            fetch(parse_DB_json)
                .then(function (response) {
                    return response.json();
                })
                    .then(function (fdata) {
                        loaded_labels = fdata;
                        json_loaded = true;
                        console.log("emo_labels loaded");
                        resolve(1);
                    })
                .catch(function (err) {
                    console.error(err);
                    reject(err);
                });
         }
         else resolve(1);
        });
}


/*
const label_obj = {A: loaded_labels[i].A,
                    D: loaded_labels[i].D,
                    F: loaded_labels[i].F,
                    H: loaded_labels[i].H,
                    I: loaded_labels[i].I,
                    M: loaded_labels[i].M,
                    O: loaded_labels[i].O,
                    R: loaded_labels[i].R,
                    S: loaded_labels[i].S,
                    U: loaded_labels[i].U,
                    V: loaded_labels[i].V };
*/


/*
export function label_from_filename_2(filename)
{
    //custom function to extract labels from filename

    if(filename)
    {
        let splits = filename.split("#")[1].split("_");

        if(splits.length == 8)
        {
            return [splits[1], splits[2], splits[3], splits[4], splits[5], splits[6], splits[7]];
        }
        else if(splits.length >= 5)
        {
            return [splits[1], splits[2], splits[3], splits[4], '-', '-', '-'];
        }
        else
        {
            //console.warn("Invalid filename, can't extract label from it.\t"+(filename));
            return new Array(NUM_CLASS_TYPES).fill('-');
        }
    }
    else
    {
        console.error("Error: Filename is required to extract emo labels.");
        return new Array(NUM_CLASS_TYPES).fill('-');
    }
}

*/
