# Web Speech Analyzer

A JS [Web API](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext) based spectrum analyzer for speech and music analysis. It can be used for labeling, feature extraction and training a neural network to classify audio files into categories or training a regression model for continuous labels.

## Demo

- [Web Speech Analyzer](https://tabahi.github.io/WebSpeechAnalyzer/?dev=1)
- [Speech Emotion Analyzer](https://tabahi.github.io/WebSpeechAnalyzer/?type=cats&label=emotion)

- [formantanalyzer.js minimal](https://tabahi.github.io/formantanalyzer.js/)

## formantanalyzer.js

This project is built using the formantanalyzer.js as the feature extractor.

![npm](https://img.shields.io/npm/v/formantanalyzer?style=plastic)
![GitHub branch checks state](https://img.shields.io/github/checks-status/tabahi/formantanalyzer.js/main)
![NPM](https://img.shields.io/npm/l/formantanalyzer?style=plastic)

Visit [tabahi/formantanalyzer.js](https://github.com/tabahi/formantanalyzer.js) for more details.

### Data collection

 In the `WebSpeechAnalyzer` web app that is build upon `formantanalyzer` library, there is also an option for training a neural network with ml5js that has tensorflow backend.

Data is collected in the browser's local storage. Chrome has a fixed limited storage of 512KB, firefox has the same but it can be increased if you need to collect and label huge amount of audio samples (>100). See instructions here to increase the data storage capacity of your browser [here](https://arty.name/localstorage.html).

To see more details about features, see `function formant_features(formants)` in file `src/formants.js` [here](https://github.com/tabahi/formantanalyzer.js/blob/main/src/formants.js#L25).

The `Segment Features` and `Syllable Features` output modes return 53 features per time frame (~25ms). These features include 16 features of top 3 formants; mel-frequency (energy weighted), sum of power of formant across it's (vertical) bandwidth, and the bandwidth span of the formant, and 5 features for the overall spectrum measurements such as pauses, noise, amplitude maximum and minimum etc. The colors at the peak amplitudes of formants in the the plot represent formants f0 to f6 as green, magenta, cyan, orange, purple, purple, purple. The code for statistical calculations of features can be found in `formants.js`. A better documentation are yet to come. Please contact the author if you need detailed explanations.

### ML Training

Currently, only the fixed sized output level such as `Segment Features` and `Syllable Features` are the trainable output levels because they output fixed number of features (53) per segment or syllable. To try different layers see references from [ml5js](https://learn.ml5js.org/#/reference/neural-network?id=defining-custom-layers).

In case, someone wants to try CNN layers with padding / masking etc to work with all other modes, then edit the source in `function train_nn(db_id, label_type, label_name)` in file `neuralmodel.js`.



## Citations

```tex
@misc{https://doi.org/10.48550/arxiv.2204.11382,
  doi = {10.48550/ARXIV.2204.11382},
  
  url = {https://arxiv.org/abs/2204.11382},
  
  author = {Rehman, Abdul and Liu, Zhen-Tao and Wu, Min and Cao, Wei-Hua and Jiang, Cheng-Shan},
  
  keywords = {Sound (cs.SD), Human-Computer Interaction (cs.HC), Machine Learning (cs.LG), Audio and Speech Processing (eess.AS), FOS: Computer and information sciences, FOS: Computer and information sciences, FOS: Electrical engineering, electronic engineering, information engineering, FOS: Electrical engineering, electronic engineering, information engineering, I.5.2; I.5.5},
  
  title = {Real-time Speech Emotion Recognition Based on Syllable-Level Feature Extraction},
  
  publisher = {arXiv},
  
  year = {2022},
  
  copyright = {arXiv.org perpetual, non-exclusive license}
}

```

Paper (pre-print): [Real-time Speech Emotion Recognition Based on Syllable-Level Feature Extraction](https://arxiv.org/abs/2204.11382)

