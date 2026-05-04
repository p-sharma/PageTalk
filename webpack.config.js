const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return {
    entry: {
      background: './src/background/index.ts',
      content: './src/content/index.ts',
      sidepanel: './src/sidepanel/index.ts',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    optimization: {
      runtimeChunk: false,
      splitChunks: false,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/sidepanel/index.html',
        filename: 'sidepanel.html',
        chunks: ['sidepanel'],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'manifest.json', to: '.' },
          { from: 'icons', to: 'icons' },
        ],
      }),
    ],
    devtool: isDev ? 'cheap-module-source-map' : false,
  };
};
