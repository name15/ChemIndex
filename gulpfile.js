const { src, dest, watch, series } = require("gulp");
const connect = require("gulp-connect");
const ts = require("gulp-typescript");
const peg = require("pegjs");
const del = require("del");
const glob = require("glob");
const fs = require("fs");
const path = require("path");

const tsProject = ts.createProject("tsconfig.json");

function startServer(cb) {
  connect.server(
    {
      root: "dist",
      livereload: true,
      host: 8080,
    },
    cb
  );
}

function watchFiles(cb) {
  watch("src/*.html", html);
  watch("src/*.css", css);
  watch("src/*.ts", typescript);
  watch("src/*.pegjs", pegjs);
  cb();
}

function html() {
  return src("src/*.html").pipe(dest("dist")).pipe(connect.reload());
}

function css() {
  return src("src/*.css").pipe(dest("dist")).pipe(connect.reload());
}

function typescript() {
  return tsProject.src().pipe(tsProject()).js.pipe(dest("dist"));
}

function pegjs(cb) {
  // TODO: Make it similar to the typescript pipe
  for (let srcPath of glob.sync("src/*.pegjs")) {
    let grammer = fs.readFileSync(srcPath, "utf-8");
    let parser = peg.generate(grammer, {
      output: "source",
      format: "bare",
    });
    // Define as global variable
    parser = "const PEG = " + parser;
    let fileName = path.basename(srcPath, path.extname(srcPath));
    let distPath = "dist/" + fileName + ".js";
    fs.writeFileSync(distPath, parser);
  }
  connect.reload();
  cb();
}

function copyFiles(cb) {
  html(cb);
  css(cb);
  typescript(cb);
  pegjs(cb);
}

function clean() {
  return del(["dist/**", "!dist"]);
}

exports.default = series(clean, copyFiles, startServer, watchFiles);
