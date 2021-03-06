/* eslint-disable quotes */
const fs = require("fs");
const {
  series,
  rimraf,
  copy,
  mkdirp
} = require("nps-utils");
const env = require("env-variable")();
const joinPath = require("path.join");
const cwd = require("cwd")();
const config = require("./config/default.json");
const computeGasLimit = require("./gasLimits.js").computeGasLimit;
/**
 * environment variables you can use to configure stuff like migrateContracts
 */
const pathArcJsRoot = env.pathArcJsRoot || cwd;

const pathArcJsContracts = joinPath(pathArcJsRoot, "migrated_contracts");

const pathDaostackArcRepo = joinPath(pathArcJsRoot, "node_modules/@daostack/arc");

const pathArcTest = joinPath(pathArcJsRoot, "test");

const pathArcTestBuild = joinPath(pathArcJsRoot, "test-build");

const pathDaostackArcGanacheDb = joinPath(pathArcJsRoot, "ganacheDb");
const pathDaostackArcGanacheDbZip = joinPath(pathArcJsRoot, "ganacheDb.zip");

const network = env.arcjs_network || config.network || "ganache";


// this is needed to force travis to use our modified version of truffle
const truffleIsInternal = fs.existsSync(joinPath(pathArcJsRoot, "node_modules", "truffle-core-migrate-without-compile"));
const truffleCommand = `node ${joinPath(pathArcJsRoot, truffleIsInternal ? "node_modules" : "../../", "truffle-core-migrate-without-compile", "cli")}`;

const ganacheCommand = `ganache-cli -l ${computeGasLimit(6)} --account="0x8d4408014d165ec69d8cc9f091d8f4578ac5564f376f21887e98a6d33a6e3549,9999999999999999999999999999999999999999999" --account="0x2215f0a41dd3bb93f03049514949aaafcf136e6965f4a066d6bf42cc9f75a106,9999999999999999999999999999999999999999999" --account="0x6695c8ef58fecfc7410bf8b80c17319eaaca8b9481cc9c682fd5da116f20ef05,9999999999999999999999999999999999999999999" --account="0xb9a8635b40a60ad5b78706d4ede244ddf934dc873262449b473076de0c1e2959,9999999999999999999999999999999999999999999" --account="0x55887c2c6107237ac3b50fb17d9ff7313cad67757e44d1be5eb7bbf9fc9ca2ea,9999999999999999999999999999999999999999999" --account="0xb16a587ad59c2b3a3f47679ed2df348d6828a3bb5c6bb3797a1d5a567ce823cb,9999999999999999999999999999999999999999999"`;
const ganacheDbCommand = `ganache-cli --db ${pathDaostackArcGanacheDb} -l ${computeGasLimit(6)} --networkId 1512051714758 --mnemonic "behave pipe turkey animal voyage dial relief menu blush match jeans general"`;

const migrationScriptExists = fs.existsSync(joinPath(pathArcJsRoot, "dist", "migrations", "2_deploy_organization.js"));

module.exports = {
  scripts: {
    ganache: {
      default: "nps ganache.run",
      run: ganacheCommand,
    },
    ganacheDb: {
      default: "nps ganacheDb.run",
      run: series(
        mkdirp(pathDaostackArcGanacheDb),
        ganacheDbCommand,
      ),
      clean: rimraf(pathDaostackArcGanacheDb),
      zip: `node ./package-scripts/archiveGanacheDb.js ${pathDaostackArcGanacheDbZip} ${pathDaostackArcGanacheDb}`,
      unzip: series(
        `node ./package-scripts/unArchiveGanacheDb.js  ${pathDaostackArcGanacheDbZip} ${pathArcJsRoot}`
      ),
      restoreFromZip: series(
        "nps ganacheDb.clean",
        "nps ganacheDb.unzip"
      )
    },
    lint: {
      default: series(
        "nps lint.code",
        "nps lint.test"
      ),
      code: {
        default: "tslint custom_typings/web3.d.ts custom_typings/system.d.ts lib/**/*.ts",
        andFix: "nps \"lint.code --fix\""
      },
      test: {
        default: "tslint custom_typings/web3_global.d.ts custom_typings/system.d.ts test/**/*.ts",
        andFix: "nps \"lint.test --fix\""
      },
      andFix: series(
        "nps lint.code.andFix",
        "nps lint.test.andFix"
      ),
    },
    test: {
      default: series(
        "nps test.build",
        "nps \"test.run test-build/test\""
      ),
      bail: series(
        "nps test.build",
        "nps \"test.run --bail test-build/test\""
      ),
      run: series("mocha --require chai --timeout 999999"),
      build: {
        default: series(
          "nps test.build.clean",
          mkdirp(`${pathArcTestBuild}/config`),
          copy(`./config/**/* ${pathArcTestBuild}/config`),
          copy(`./gasLimits.js ${pathArcTestBuild}`),
          copy(`./migrated_contracts/**/* ${pathArcTestBuild}/migrated_contracts`),
          mkdirp(pathArcTestBuild),
          `node node_modules/typescript/bin/tsc --outDir ${pathArcTestBuild} --project ${pathArcTest}`
        ),
        clean: rimraf(joinPath(pathArcTestBuild, "*"))
      },
    },
    build: {
      default: series(
        "nps build.clean",
        mkdirp(joinPath(pathArcJsRoot, "dist")),
        `node node_modules/typescript/bin/tsc --outDir ${joinPath(pathArcJsRoot, "dist")}`
      ),
      clean: rimraf(joinPath(pathArcJsRoot, "dist"))
    },
    deploy: {
      pack: series("nps build", "npm pack"),
      publish: series("nps build", "npm publish")
    },
    /**
     * See README.md for how to use these scripts in a workflow to migrate contracts
     */
    migrateContracts: {
      /**
       * Migrate contracts.
       *
       * Truffle will merge this migration with whatever previous ones are already present in the contract json files.
       *
       * Run migrateContracts.fetchFromArc first if you want to start with fresh unmigrated contracts from @daostack/arc.
       *
       * --reset is for ganacheDb to not crash on re-migration
       */
      default: series(
        migrationScriptExists ? `` : `nps build`,
        `${truffleCommand} migrate --reset --contracts_build_directory ${pathArcJsContracts} --without-compile --network ${network}`
      ),
      /**
       * Clean the output contract json files, optionally andMigrate.
       *
       * IMPORTANT! Only do this if you aren't worried about losing
       * previously-performed migrations to other networks.  By cleaning, you'll lose them, starting
       * from scratch.  Otherwise, truffle will merge your migrations into whatever  previous
       * ones exist.
       */
      clean: {
        default: rimraf(joinPath(pathArcJsContracts, "*")),
        /**
         * clean and fetch.
         * Run this ONLY when you want to start with fresh UNMIGRATED contracts from @daostack/arc.
         */
        andFetchFromArc: series(
          "nps migrateContracts.clean",
          "nps migrateContracts.fetchFromArc"
        ),
        /**
         * clean, fetch and migrate.
         * Run this ONLY when you want to start with fresh UNMIGRATED contracts from @daostack/arc.
         */
        andMigrate: series(
          "nps migrateContracts.clean.andFetchFromArc",
          "nps migrateContracts"
        )
      },
      /**
       * Fetch the unmigrated contract json files from DAOstack Arc.
       * Run this ONLY when you want to start with fresh UNMIGRATED contracts from DAOstack Arc.
       * Best to run "migrateContracts.clean" first.
       */
      fetchFromArc: copy(`${joinPath(pathDaostackArcRepo, "build", "contracts", "*")}  ${pathArcJsContracts}`)
    },
    docs: {
      api: {
        build: "node ./package-scripts/typedoc.js",
        /**
         * This is to create a list of all the API files for inclusion in mkdocs.yml
         * Whenever the set of API objects changes, you must copy the output of this
         * script and paste it into mkdocs.yml after the line:
         * `- Index : "api/README.md"`
         *
         * Easy Powershell command:  nps -s docs.api.createPagesList | ac .\mkdocs.yml
         */
        createPagesList: `node ./package-scripts/createApiPagesList.js ./docs api/*/**`
      },
      website: {
        build: "mkdocs build",
        preview: "mkdocs serve",
        publish: "mkdocs gh-deploy --force"
      },
      build: {
        default: series(
          "nps docs.api.build",
          "nps docs.website.build",
        ),
        andPreview: series("nps docs.build", "nps docs.website.preview"),
        andPublish: series("nps docs.build", "nps docs.website.publish")
      },
      clean: series(
        rimraf(joinPath(pathArcJsRoot, "docs", "api")),
        rimraf(joinPath(pathArcJsRoot, "site"))
      )
    }
  }
};
