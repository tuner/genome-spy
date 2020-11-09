const merge = require("webpack-merge");
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
    mode: "development",
    devtool: "inline-source-map",

    entry: {
        main: "./src/index.js"
    },

    plugins: [
        new HtmlWebpackPlugin({
            title: "GenomeSpy Playground"
        })
    ],

    resolve: {
        symlinks: false
    },

    module: {
        rules: [
            {
                test: /\.(s*)css$/,
                use: ["style-loader", "css-loader", "sass-loader"]
            },
            {
                test: /\.(txt|[ct]sv|glsl)$/,
                use: "raw-loader"
            }
        ]
    }
};
