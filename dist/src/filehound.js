"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const _ = require("lodash");
const path = require("path");
const files_1 = require("./files");
const arrays_1 = require("./arrays");
const unit_compare_1 = require("unit-compare");
const events_1 = require("events");
const matcher_1 = require("./matcher");
const walker = require("./walker/walk");
const bind_1 = require("./bind");
function isDefined(value) {
    return value !== undefined;
}
function flatten(a, b) {
    return a.concat(b);
}
function cleanExtension(ext) {
    if (_.startsWith(ext, '.')) {
        return ext.slice(1);
    }
    return ext;
}
/** @class */
class FileHound extends events_1.EventEmitter {
    constructor() {
        super();
        this.matcher = new matcher_1.Matcher();
        this.searchPaths = [];
        this.searchPaths.push(process.cwd());
        this.ignoreDirs = false;
        this.directoriesOnly = false;
        bind_1.default(this);
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Static factory method to create an instance of FileHound
     *
     * @static
     * @memberOf FileHound
     * @method
     * create
     * @return FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     */
    static create() {
        return new FileHound();
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Returns all matches from one of more FileHound instances
     *
     * @static
     * @memberOf FileHound
     * @method
     * any
     * @return a promise containing all matches. If the Promise fulfils,
     * the fulfilment value is an array of all matching files.
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.any(fh1, fh2);
     */
    static any(...args) {
        return __awaiter(this, void 0, void 0, function* () {
            const pending = args.map(fh => fh.find());
            const files = yield Promise.all(pending);
            return files.reduce(flatten, []);
        });
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filters by modifiction time
     *
     * @memberOf FileHound
     * @method
     * modified
     * @param {string} dateExpression - date expression
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .modified("< 2 days")
     *   .find()
     *   .each(console.log);
     */
    modified(pattern) {
        return this.addFilter((file) => {
            const modified = file.lastModifiedSync();
            return unit_compare_1.isDate(modified)
                .assert(pattern);
        });
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filters by file access time
     *
     * @memberOf FileHound
     * @method
     * accessed
     * @param {string} dateExpression - date expression
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .accessed("< 10 minutes")
     *   .find()
     *   .each(console.log);
     */
    accessed(pattern) {
        return this.addFilter((file) => {
            const accessed = file.lastAccessedSync();
            return unit_compare_1.isDate(accessed)
                .assert(pattern);
        });
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filters change time
     *
     * @memberOf FileHound
     * @instance
     * @method
     * changed
     * @param {string} dateExpression - date expression
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .changed("< 10 minutes")
     *   .find()
     *   .each(console.log);
     */
    changed(pattern) {
        return this.addFilter((file) => {
            const changed = file.lastChangedSync();
            return unit_compare_1.isDate(changed)
                .assert(pattern);
        });
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     *
     * @memberOf FileHound
     * @instance
     * @method
     * addFilter
     * @param {function} function - custom filter function
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .addFilter(customFilter)
     *   .find()
     *   .each(consoe.log);
     */
    addFilter(filter) {
        this.matcher.on(filter);
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Defines the search paths
     *
     * @memberOf FileHound
     * @instance
     * @method
     * paths
     * @param {array} path - array of paths
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .paths("/tmp", "/etc") // or ["/tmp", "/etc"]
     *   .find()
     *   .each(console.log);
     */
    paths(...args) {
        this.searchPaths = _.uniq(arrays_1.from(args))
            .map(path.normalize);
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Define the search path
     *
     * @memberOf FileHound
     * @instance
     * @method
     * path
     * @param {string} path - path
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .path("/tmp")
     *   .find()
     *   .each(console.log);
     */
    path(path) {
        return this.paths(path);
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Ignores files or sub-directories matching pattern
     *
     * @memberOf FileHound
     * @instance
     * @method
     * discard
     * @param {string|array} regex - regex or array of regex
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .discard("*.tmp*")
     *   .find()
     *   .each(console.log);
     */
    discard(...args) {
        const patterns = arrays_1.from(args);
        patterns.forEach((pattern) => {
            this.addFilter(matcher_1.Matcher.negate(matcher_1.Matcher.isMatch(pattern)));
        });
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filter on file extension
     *
     * @memberOf FileHound
     * @instance
     * @method
     * ext
     * @param {string|array} extensions - extension or an array of extensions
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * let filehound = FileHound.create();
     * filehound
     *   .ext(".json")
     *   .find()
     *   .each(console.log);
     *
     * // array of extensions to filter by
     * filehound = FileHound.create();
     * filehound
     *   .ext([".json", ".txt"])
     *   .find()
     *   .each(console.log);
     *
     * // supports var args
     * filehound = FileHound.create();
     * filehound
     *   .ext(".json", ".txt")
     *   .find()
     *   .each(console.log);
     */
    ext(...args) {
        const extensions = arrays_1.from(args)
            .map(cleanExtension);
        return this.addFilter(file => _.includes(extensions, file.getPathExtension()));
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filter by file size
     *
     * @memberOf FileHound
     * @instance
     * @method
     * size
     * @param {string} sizeExpression - a size expression
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .size("<10kb")
     *   .find()
     *   .each(console.log);
     */
    size(sizeExpression) {
        return this.addFilter((file) => {
            const size = file.sizeSync();
            return unit_compare_1.isNumber(size)
                .assert(sizeExpression);
        });
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filter by zero length files
     *
     * @memberOf FileHound
     * @instance
     * @method
     * isEmpty
     * @param {string} path - path
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .size("<10kb")
     *   .find()
     *   .each(console.log);
     */
    isEmpty() {
        return this.size(0);
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filter by a file glob
     *
     * @memberOf FileHound
     * @instance
     * @method
     * glob
     * @param {string} glob - file glob
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .glob("*tmp*")
     *   .find()
     *   .each(console.log); // array of files names all containing 'tmp'
     */
    glob(globPattern) {
        return this.match(globPattern);
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Same as glob
     * @see glob
     */
    match(globPattern) {
        return this.addFilter(file => file.isMatch(globPattern));
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Negates filters
     *
     * @memberOf FileHound
     * @instance
     * @method
     * not
     * @param {string} glob - file glob
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .not()
     *   .glob("*tmp*")
     *   .find()
     *   .each(console.log); // array of files names NOT containing 'tmp'
     */
    not() {
        this.matcher.negateAll();
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Filter to ignore hidden files
     *
     * @memberOf FileHound
     * @instance
     * @method
     * ignoreHiddenFiles
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .ignoreHiddenFiles()
     *   .find()
     *   .each(console.log); // array of files names that are not hidden files
     */
    ignoreHiddenFiles() {
        return this.addFilter(file => !file.isHiddenSync());
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Ignore hidden directories
     *
     * @memberOf FileHound
     * @instance
     * @method
     * ignoreHiddenDirectories
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .ignoreHiddenDirectories()
     *   .find()
     *   .each(console.log); // array of files names that are not hidden directories
     */
    ignoreHiddenDirectories() {
        this.ignoreDirs = true;
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Find sub-directories
     *
     * @memberOf FileHound
     * @instance
     * @method
     * directory
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .directory()
     *   .find()
     *   .each(console.log); // array of matching sub-directories
     */
    directory() {
        this.directoriesOnly = true;
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Find sockets
     *
     * @memberOf FileHound
     * @instance
     * @method
     * socket
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .socket()
     *   .find()
     *   .each(console.log); // array of matching sockets
     */
    socket() {
        return this.addFilter(file => file.isSocket());
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Specify the directory search depth. If set to zero, recursive searching
     * will be disabled
     *
     * @memberOf FileHound
     * @instance
     * @method
     * depth
     * @return a FileHound instance
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .depth(0)
     *   .find()
     *   .each(console.log); // array of files names only in the current directory
     */
    depth(depth) {
        this.maxDepth = depth;
        return this;
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Asynchronously executes a file search.
     *
     * @memberOf FileHound
     * @instance
     * @method
     * find
     * @param {function} function - Optionally accepts a callback function
     * @return Returns a Promise of all matches. If the Promise fulfils,
     * the fulfilment value is an array of all matching files
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * filehound
     *   .find()
     *   .each(console.log);
     *
     * // using a callback
     * filehound
     *   .find((err, files) => {
     *      if (err) return console.error(err);
     *
     *      console.log(files);
     *   });
     */
    find() {
        return __awaiter(this, void 0, void 0, function* () {
            const paths = this.getSearchPaths();
            const searches = [];
            const matcher = this.matcher.create();
            for (const path of paths) {
                searches.push(this.searchAsync(path, matcher));
            }
            try {
                const results = yield Promise.all(searches);
                return results
                    .reduce(flatten)
                    .map((file) => {
                    this.emit('match', file);
                    return file;
                });
            }
            catch (e) {
                this.emit('error', e);
            }
            finally {
                this.emit('end');
            }
        });
    }
    // tslint:disable-next-line:valid-jsdoc
    /**
     * Synchronously executes a file search.
     *
     * @memberOf FileHound
     * @instance
     * @method
     * findSync
     * @return Returns an array of all matching files
     * @example
     * import FileHound from 'filehound';
     *
     * const filehound = FileHound.create();
     * const files = filehound.findSync();
     * console.log(files);
     *
     */
    findSync() {
        return this.getSearchPaths()
            .map(this.searchSync)
            .reduce(flatten);
    }
    getSearchPaths() {
        const paths = isDefined(this.maxDepth)
            ? this.searchPaths
            : files_1.reducePaths(this.searchPaths);
        return arrays_1.copy(paths);
    }
    createSearchOpts() {
        return {
            ignoreDirs: this.ignoreDirs,
            maxDepth: this.maxDepth,
            directoriesOnly: this.directoriesOnly
        };
    }
    searchSync(dir) {
        return walker.sync(dir, this.matcher.create(), this.createSearchOpts());
    }
    searchAsync(dir, matcher) {
        return __awaiter(this, void 0, void 0, function* () {
            return walker.async(dir, matcher, this.createSearchOpts());
        });
    }
}
exports.default = FileHound;
//# sourceMappingURL=filehound.js.map