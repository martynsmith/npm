
// activate a version of a package
// this presumes that it's been installed
// no need to worry about dependencies, because they were
// installed into the child package anyhow.

var mkdir = require("./utils/mkdir-p")
  , npm = require("../npm")
  , fs = require("fs")
  , log = require("./utils/log")
  , path = require("path")
  , rm = require("./utils/rm-rf")
  , chain = require("./utils/chain")
  , lifecycle = require("./utils/lifecycle")
  , readJson = require("./utils/read-json")

module.exports = activate

function activate (args, cb) {
  // make sure package and version exists.
  // If there's already an active version, then deactivate it.
  // first, link .npm/{pkg}/{version} to .npm/{pkg}/{active}
  // then, link the things in the root without a version to the active one.

  var pkg = args[0]
    , version = args[1]
    , from = path.join(npm.dir, pkg, version)
    , to = path.join(npm.dir, pkg, "active")
    , fromMain = path.join(npm.dir, pkg, "active/main.js")
    , toMain = path.join(npm.root, pkg+".js")
    , fromLib = path.join(npm.dir, pkg, "active/lib")
    , toLib = path.join(npm.root, pkg)
    , jsonFile = path.join(npm.dir, pkg, version, "/package/package.json")

  if (!version) {
    cb(new Error("Please specify a version to activate"))
  }

  // TODO: If "to" already exists, then do deactivate step implicitly
  chain
    ( function (cb) { npm.commands.deactivate([pkg], function () { cb() }) }
    , function (cb) {
        fs.lstat(to, function (er, stat) {
          if (!er) return fs.readlink(to, function (active) {
            cb(new Error("Implicit deactivate failed.\n"+
              pkg+" "+active+" still active."))
          })
          else cb()
        })
      }
    , [readJson, jsonFile, function (er, data) {
        if (er) cb(er)
        npm.set(data)
        chain
          ( [lifecycle, data, "preactivate"]
          , [link, from, to]
          , function (cb) {
              fs.stat(fromMain, function (er, stat) {
                if (er) return cb()
                link(fromMain, toMain, cb)
              })
            }
          , function (cb) {
              fs.stat(fromLib, function (er, stat) {
                if (er) return cb()
                link(fromLib, toLib, cb)
              })
            }
          , [linkBins, data]
          , [lifecycle, data, "activate"]
          , [lifecycle, data, "postactivate"]
          , cb
          )
      }]
    , cb
    )
}

function link (from, to, cb) {
  chain
    ( [fs, "stat", from]
    // todo: implicit deactivation rather than this crude clobbering.
    , [rm, to]
    , [fs, "symlink", from, to]
    , cb
    )
}

function linkBins (pkg, cb) {
  if (!pkg.bin) return cb()
  var steps = []
  for (var i in pkg.bin) {
    var to = path.join(npm.config.get('binroot'), i)
      , from = to+"-"+pkg.version
    steps.push([link, from, to])
  }
  steps.push(cb)
  chain(steps)
}
