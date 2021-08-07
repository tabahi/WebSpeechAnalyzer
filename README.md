# Formant Analyzer

A JS [Web API](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) based spectrum analyzer for speech and music analysis. It can be used for labeling or feature extraction.

## Demo
Try speech analyzer demo at: [tabahi.github.io/WebSpeechAnalyzer/?dev=1](https://tabahi.github.io/WebSpeechAnalyzer/?dev=1)

Try emotion analyzer demo at: [tabahi.github.io/WebSpeechAnalyzer/?type=cats&label=emotion](https://tabahi.github.io/WebSpeechAnalyzer/?type=cats&label=emotion)


Mel spectrum demo at: [tabahi.github.io/WebSpeechAnalyzer/?mode=2](https://tabahi.github.io/WebSpeechAnalyzer/?mode=2&p=samples/Haendel_Lascia_chi_o_pianga.mp4 )

Bare minimum starter file: [tabahi.github.io/WebSpeechAnalyzer/simple.html](https://tabahi.github.io/WebSpeechAnalyzer/simple.html)



## Installation

### Using JS Script

Load the javascript module as
```html
<script src="https://unpkg.com/formantanalyzer@1.1.6/index.js"></script>
```
Then use the entry point `FormantAnalyzer` to use the imported javascript library.

### Using Webpack Library

Prerequisites: [Node.js](https://nodejs.org/en/download/), check versions >12 for `node -v` and >6 for `npm -v`.

- For importing the JS package in webpack project: Install [formantanalyzer](https://www.npmjs.com/package/formantanalyzer) using `npm`

```cmd
npm i formantanalyzer
:: or
npm install formantanalyzer --save-dev
```


```javascript
const FormantAnalyzer = require('formantanalyzer'); //after npm installation
FormantAnalyzer.configure(launch_config);
FormantAnalyzer.LaunchAudioNodes(2, webAudioElement, call_backed_function, ['file_label'], false, false);
```



If you are creating a webpack project from scratch by just using JS files from `./src` then first initialize a new webpack project by `npx webpack` and create a new `webconfig.js` in project root directory. See instructions [here](https://webpack.js.org/guides/getting-started/#using-a-configuration).

## Usage

First, configure the fomant analyzer. Pass the `#SpectrumCanvas` element if plot is enabled. Pass `null` if no need for plot. See `simple.html` for a simple example.

HTML:
```html
<div id="canvas_div">
    <canvas id="SpectrumCanvas" width="1200" height="300" ></canvas>
</div>
```
In javascript:
```javascript
/*Using <script src="https://unpkg.com/formantanalyzer@1.1.6/index.js"></script>
Can also import in webpack as:
const FormantAnalyzer = require('formantanalyzer');
*/

function Configure_FormantAnalyzer()
    {
        const BOX_HEIGHT = 300;
        const BOX_WIDTH = window.screen.availWidth - 50;
        document.getElementById('SpectrumCanvas').width = BOX_WIDTH;    //reset the size of canvas element
        document.getElementById('SpectrumCanvas').height = BOX_HEIGHT;
        
        let launch_config = { plot_enable: true,
        spec_type: 1,
        output_level: 2,
        plot_len: 200,
        f_min: 50,
        f_max: 4000,
        N_fft_bins: 256,
        N_mel_bins: 128,
        window_width: 25,
        window_step: 15,
        pause_length: 200,
        min_seg_length: 50,
        auto_noise_gate: true,
        voiced_min_dB: 10,
        voiced_max_dB: 100,
        plot_lag: 1,
        pre_norm_gain: 1000,
        high_f_emph: 0.0,
        plot_canvas: document.querySelector('#SpectrumCanvas').getContext('2d'),
        canvas_width: BOX_WIDTH,
        canvas_height: BOX_HEIGHT };

        FormantAnalyzer.configure(launch_config);

    }
```

Available `spec_type` options:
- 1 = Mel-spectrum
- 2 = Power Spectrum
- 3 = Discrete FFT

Available `output_level` options:

- 1 = Bars (no spectrum, only the last filter bank)
- 2 = Spectrum
- 3 = Segments
- 4 = Segment Formants
- 5 = Segment Features [ML]
- 10 = Syllable Formants
- 11 = Distributions 264x [ML]
- 12 = Syllable Curves 23x [ML]
- 13 = Syllable 53x [ML]

Then initialize an Audio Element, or local audio file binary element, or `null` if using the mic stream. Then pass it to `LaunchAudioNodes` with suitable parameters. See `simple.html` for examples for local audio file and mic streaming.

```javascript

var webAudioElement = new Audio("./audio_file.mp3");
/*Parameters:*/
const source = 2;   //1: Local file binary, 2: play from a web Audio, 3: mic
const test_mode = true; //plots only, it does not return callback
const offline = false;  //play on speakers, set true to play silently
const callback = null;  //callback function to which extracted features are passed
const file_labels =[];     //array of labels that will be passed to callback after feature extraction

/* Wait for audio file to load */
webAudioElement.addEventListener("canplaythrough", event => {
    /* Launch Audio Nodes */
    FormantAnalyzer.LaunchAudioNodes(source, webAudioElement,
                    callback, file_labels, offline, test_mode).then(function()
        {
            console.log("Done");
        }).catch((err)=>{
            console.log(err);
        });
});
```

## `LaunchAudioNodes` 

Returns: This function returns a promise as `resolve(true)` after playback is finished or `reject(err)` if there is an error.
If you want an abrupt stop, then call the `FormantAnalyzer.stop_playing("no reason")` function. Then this function will return `resolve("no reason")`.

### Parameters:

`context_source` (int):
- 1 --- Play from a loaded file - online (on speakers)
- 1 --- Play from a loaded file - offline (silently in the background)
- 2 --- Play from an Audio element (pass audio object as source_obj)
- 3 --- Stream from mic

`source_obj` (object):
Source audio object.
- If `context_source==1` (playing from a local file) then pass a binary of audio.
- If `context_source==2` (playing from a web address) then pass Audio object.
- If `context_source==3` (playing from mic Pass `null`). Different audio contexts are buffered/streamed differently, therefore each has a separate function in AudioNodes.js

`callback`:
It is the callback function to be called after each segment ends. It should accept 4 variables; `segment_index`, `segment_time_array`, `segment_labels_array`, `segment_features_array`. Callback is called asynchronously, so there might be a latency between audio play and it's respective callback, that's why it's important to send the labels to async segmentor function.

`label` (Array):
It is an array of labels for currently playing file. It is returned as it is to the callback function.
It is used to avoid the label mismatch during slow async processing in case if a new file is playing, but the callback sends the output of the previous one.
Sometimes callback is called with a delay of 2 seconds, so it helps to keep track which file was playing 2 seconds ago.

`offline_mode` (boolean):
If true then the locally loaded files will be played silently in an offline buffer.


`test_play` (boolean)
set it true to avoid calling the callback. Plots and AudioNodes will still work as it is, but there will be no call backs. It can be enabled to test plotting or re listening.

`play_offset` and `play_duration` are in seconds to play a certain part of the file, otherwise pass null.


# WebSpeechAnalyzer analysis features

## Data collection

 In the `WebSpeechAnalyzer` web app that is build upon `formantanalyzer` library, there is also an option for training a neural network with ml5js that has tensorflow backend.

Data is collected in the browser's local storage. Chrome has a fixed limited storage of 512KB, firefox has the same but it can be increased if you need to collect and label huge amount of audio samples (>100). [See instructions here to increase the data storage capacity of your browser](https://arty.name/localstorage.html).

To see more details about features, see `function formant_features(formants)` in file `./FormantAnalyzerLibrary/src/formants.js`.

The `Segment Features` and `Syllable Features` output modes return 53 features per time frame (~25ms). These features include 16 features of top 3 formants; mel-frequency (energy weighted), sum of power of formant across it's (vertical) bandwidth, and the bandwidth span of the formant, and 5 features for the overall spectrum measurements such as pauses, noise, amplitude maximum and minimum etc. The colors at the peak amplitudes of formants in the the plot represent formants f0 to f6 as green, magenta, cyan, orange, purple, purple, purple. The code for statistical calculations of features can be found in `formants.js`. A better documentation are yet to come. Please contact the author if you need detailed explanations.

## ML Training

Currently, only the `Segment Features` and `Syllable Features` are the trainable output levels because they output fixed number of features (53) per segment or syllable. To try different layers see references from [ml5js](https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers).

In case, someone wants to use CNN layers with padding / masking etc to work with all other modes, then edit the source in `function train_nn(db_id, label_type, label_name)` in file `neuralmodel.js`.
