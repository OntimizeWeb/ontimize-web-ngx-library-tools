#! /usr/bin/env node
'use strict';
const shell = require("shelljs");
const yargs = require("yargs");
const { runBuild, cleanLibraryAssets } = require('./build');

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}

var argv = yargs.usage("$0 command")
  .command("build", "building dist folder", function (yargsBuild) {
    yargsBuild.option("package", {
      alias: "package",
      demand: true,
      describe: "package name",
      type: "string"
    })
      .option("ng-library", {
        alias: "ng-library",
        demand: true,
        describe: "package library name (ng.ontimizeWeb)",
        type: "string"
      });

    runBuild();
  })
  .demand(1, "must provide a valid command")
  .command("clean", "clean library assets", function (yargs) {
    cleanLibraryAssets();
  })
  .help("h")
  .alias("h", "help")
  .argv
