
// Walk through the file-system "database" of installed
// packages, and create a data object related to the
// installed/active versions of each package.

var npm = require("../../npm")
  , fs = require("fs")
  , path = require("path")
  , log = require("./log")
  , mkdir = require("./mkdir-p")

module.exports = readInstalled

function readInstalled (args, cb) {
  var showAll = args.length === 0
  mkdir(npm.tmp, function (er) {
    if (er) return cb(er)
    fs.readdir(npm.dir, function (er, packages) {
      if (er) return cb(er)
      packages = packages.filter(function (dir) {
        return (showAll || args.indexOf(dir) !== -1) && dir.charAt(0) !== "."
      })
      // maybe nothing found
      if (!packages.length) cb(null, null)

      var p = packages.length
        , data = {}
      function listed () { if (--p === 0) cb(null, data) }
      packages.forEach(function (package) {
        var packageDir = path.join(npm.dir, package)
          , activeVersion = null
        fs.readdir(packageDir, function (er, versions) {
          if (er) return cb(er)
          versions
            .filter(function (version) {
              if (version !== "active") return true
              var active = path.join(packageDir, "active")
              if (fs.lstatSync(active).isSymbolicLink()) {
                activeVersion = path.basename(fs.readlinkSync(active))
              }
            })
            .forEach(function (version) {
              data[package] = data[package] || {}
              data[package][version] = data[package][version] || {}
              if (activeVersion === version) data[package][version].active = true
            })
          listed()
        })
      })
    })
  })
}
