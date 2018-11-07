#! /usr/bin/env node
'use strict';
const shell = require('shelljs');
const chalk = require('chalk');
const yargs = require("yargs");

const NPM_DIR = `dist`;
const TMP_DIR = `tmp`;
const BASE_DIR = `tmp`;
const ESM2015_DIR = `${NPM_DIR}/esm2015`;
const ESM5_DIR = `${NPM_DIR}/esm5`;
const BUNDLES_DIR = `${NPM_DIR}/bundles`;
const OUT_DIR_ESM5 = `${NPM_DIR}/package/esm5`;
const LIBRARY_ASSETS_PATH = 'node_modules/ontimize-web-ngx-library-tools/bin/assets';
const LIBRARY_ASSETS = ['rollup.config.js', 'rollup.es.config.js', 'public_api.ts', 'tsconfig.aot.json', 'tsconfig.build.json'];

const FILES_REPLACE_MAP = {
  'rollup.config.js': ['NG_LIBRARY', 'LIBRARY'],
  'tsconfig.build.json': ['LIBRARY']
};

const KEYS_REPLACE_MAP = {
  'NG_LIBRARY': 'ng-library',
  'LIBRARY': 'package'
};

function copyLibraryAssets(baseFolder) {
  const args = yargs.argv;
  var copied = [];
  for (var i = 0, len = LIBRARY_ASSETS.length; i < len; i++) {
    var asset = LIBRARY_ASSETS[i];
    if (!shell.test('-f', asset)) {
      copied.push(asset);
      shell.echo(`Copying ${asset} from ontimize-web-ngx-library-tools`);
      shell.cp(`${LIBRARY_ASSETS_PATH}/${asset}`, '.');

      if (FILES_REPLACE_MAP.hasOwnProperty(asset)) {
        shell.ls(asset).forEach(function (file) {
          FILES_REPLACE_MAP[asset].forEach(function (replaceKey) {
            if (KEYS_REPLACE_MAP.hasOwnProperty(replaceKey) && args[KEYS_REPLACE_MAP[replaceKey]]) {
              var regexp = new RegExp(`${replaceKey}`, 'g');
              shell.sed('-i', regexp, args[KEYS_REPLACE_MAP[replaceKey]], file);
            }
          });
          if (asset === 'tsconfig.build.json') {
            var regexp = new RegExp(`SOURCE_PATH`, 'g');
            shell.sed('-i', regexp, `${baseFolder}`, file);
          }
        });
      }
    }
  }
  return copied;
}

function cleanLibraryAssets() {
  LIBRARY_ASSETS.forEach(function (asset) {
    if (shell.test('-f', asset)) {
      shell.rm(`-Rf`, asset);
    }
  });
}

function runBuild() {
  var args = yargs.argv;
  const PACKAGE = args.package;
  var baseFolder = BASE_DIR;
  var baseFolderTsConfig ;
  if (PACKAGE === 'ontimize-web-ngx') {
    baseFolder = 'ontimize';
    baseFolderTsConfig = baseFolder;
  } else {
    baseFolderTsConfig = baseFolder + '/src';
  }
  const OUT_DIR_AOT = `${NPM_DIR}/src`;

  shell.echo(`Start building:`, PACKAGE);

  if (shell.test('-d', `${NPM_DIR}`)) {
    shell.rm(`-Rf`, `${NPM_DIR}/*`);
  }
  if (shell.test('-d', `${TMP_DIR}`)) {
    shell.rm(`-Rf`, `${TMP_DIR}/*`);
  }
  shell.mkdir(`-p`, `./${ESM2015_DIR}`);
  shell.mkdir(`-p`, `./${ESM5_DIR}`);
  shell.mkdir(`-p`, `./${BUNDLES_DIR}`);

  var copied = copyLibraryAssets(baseFolderTsConfig);

  /* TSLint with Codelyzer */
  // https://github.com/palantir/tslint/blob/master/src/configs/recommended.ts
  // https://github.com/mgechev/codelyzer
  shell.echo(`Start TSLint`);
  shell.exec(`tslint -p tslint.json -t stylish ` + baseFolder + `/**/*.ts`);
  shell.echo(chalk.green(`TSLint completed`));

  /* Inline templates: init-common */
  shell.echo(`Start inline templates parsing`);
  shell.exec(`gulp inline-templates`);
  shell.echo(chalk.green(`Inline templates completed`));

  /* AoT compilation */
  shell.echo(`Start AoT compilation`);
  if (shell.exec(`ngc -p tsconfig.aot.json`).code !== 0) {
    shell.echo(chalk.red(`Error: AoT compilation failed`));
    shell.exit(1);
  }
  shell.echo(chalk.green(`AoT compilation completed`));

  /* BUNDLING PACKAGE */
  shell.echo(`Start bundling`);
  shell.echo(`Rollup package`);
  if (shell.exec(`rollup -c rollup.es.config.js -i ${NPM_DIR}/index.js -o ${ESM2015_DIR}/${PACKAGE}.js`).code !== 0) {
    shell.echo(chalk.red(`Error: Rollup package failed`));
    shell.exit(1);
  }
  shell.echo(chalk.green(`Rollup package completed`));

  shell.echo(`Produce ESM5 version`);
  shell.exec(`ngc -p tsconfig.build.json --target es5 -d false --outDir ${OUT_DIR_ESM5} --importHelpers true --sourceMap`);
  if (shell.exec(`rollup -c rollup.es.config.js -i ${OUT_DIR_ESM5}/${PACKAGE}.js -o ${ESM5_DIR}/${PACKAGE}.es5.js`).code !== 0) {
    shell.echo(chalk.red(`Error: ESM5 version failed`));
    shell.exit(1);
  }
  shell.echo(chalk.green(`Produce ESM5 version completed`));

  shell.echo(`Run Rollup conversion on package`);
  if (shell.exec(`rollup -c rollup.config.js -i ${ESM5_DIR}/${PACKAGE}.es5.js -o ${BUNDLES_DIR}/${PACKAGE}.umd.js`).code !== 0) {
    shell.echo(chalk.red(`Error: Rollup conversion failed`));
    shell.exit(1);
  }
  shell.echo(chalk.green(`Run Rollup conversion on package completed`));

  shell.echo(`Minifying`);
  shell.cd(`${BUNDLES_DIR}`);
  shell.exec(`uglifyjs ${PACKAGE}.umd.js -c --comments -o ${PACKAGE}.umd.min.js --source-map "filename='${PACKAGE}.umd.min.js.map', includeSources"`);
  shell.echo(chalk.green(`Minifying completed`));
  shell.cd(`..`);
  shell.cd(`..`);

  shell.echo(chalk.green(`Bundling completed`));

  copied.forEach(function (copiedAsset) {
    if (shell.test('-f', copiedAsset)) {
      shell.rm(`-Rf`, copiedAsset);
    }
  });

  shell.rm(`-Rf`, `${NPM_DIR}/package`);
  shell.rm(`-Rf`, `${NPM_DIR}/node_modules`);
  // shell.rm(`-Rf`, `${NPM_DIR}/*.js`);
  // shell.rm(`-Rf`, `${NPM_DIR}/*.js.map`);
  // shell.rm(`-Rf`, `${NPM_DIR}/` + baseFolder + `/**/*.js`);
  // shell.rm(`-Rf`, `${NPM_DIR}/` + baseFolder + `/**/*.js.map`);

  /* end-common */
  shell.echo(`Start copy-files`);
  shell.exec(`gulp copy-files`);
  shell.echo(chalk.green(`copy-files completed`));

  shell.echo(`Start styles`);
  shell.exec(`gulp styles`);
  var stylesFile = 'styles';
  if (PACKAGE === 'ontimize-web-ngx') {
    stylesFile = 'ontimize';
  }
  shell.exec(`node-sass dist/${stylesFile}.scss dist/${stylesFile}.scss --output-style compressed`);
  shell.echo(chalk.green(`Styles completed`));

  // // shell.sed('-i', `"private": true,`, `"private": false,`, `./${NPM_DIR}/package.json`);
  shell.echo(chalk.green(`End building`));
}

module.exports = {
  runBuild: runBuild,
  cleanLibraryAssets: cleanLibraryAssets
};