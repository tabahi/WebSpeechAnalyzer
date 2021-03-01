const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'var',
    library: 'SA',
  },
  resolve: {
    // Add '.ts' and '.tsx' as resolvable extensions.
    extensions: [".ts", ".tsx", ".js", ".json", ".wasm"]
  },
  mode : 'production',
  node: {
    fs: "empty"
  }

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