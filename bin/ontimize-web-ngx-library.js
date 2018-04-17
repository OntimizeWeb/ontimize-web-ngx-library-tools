#! /usr/bin/env node
'use strict';
const shell = require("shelljs");
const yargs = require("yargs");
const { runBuild } = require('./build');

if (!shell.which('git')) {
  shell.echo('Sorry, this script requires git');
  shell.exit(1);
}

yargs.command("build", "building dist folder", function (yargs) {
  // var args = yargs.argv;
  runBuild();
});

var argv = yargs.usage("$0 command")
  .demand(1, "must provide a valid command")
  .option("package", {
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
  })
  .help("h")
  .alias("h", "help")
  .argv
