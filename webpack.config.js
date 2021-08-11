const path = require('path');
const url = require('url');

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

  devServer: {
    host: '127.0.0.1',
    port: 8010,
    proxy: {
      '/api/': {
        target: 'http://127.0.0.1:8011',
        changeOrigin: true,
        pathRewrite: {
          '^/api': ''
        }
      }
    },
    historyApiFallback: {
      index: url.parse('/assets/').pathname
    }
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