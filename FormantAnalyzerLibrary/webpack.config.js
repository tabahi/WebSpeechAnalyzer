const path = require('path');

module.exports = {
  entry: "./src/AudioLauncher.js",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, ""),
    library: "FormantAnalyzer",
    libraryTarget: 'umd',
    globalObject: 'this',
  },
  mode : 'production',
};
/*
production
development


  mode : 'production',
  node: {
    fs: "empty"
  }

mode : 'development',
  devtool: 'inline-source-map',
  node: {
    fs: "empty"
  }
*/