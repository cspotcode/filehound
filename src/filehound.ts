import * as _ from 'lodash';
import { Promise } from 'bluebird';
import * as path from 'path';
import * as File from 'file-js';

import { negate, compose } from './functions';
import { reducePaths } from './files';
import { copy, from } from './arrays';
import { isDate, isNumber } from 'unit-compare';
import { EventEmitter } from 'events';
import auto from './bind';

function isDefined(value: any): any {
  return value !== undefined;
}

function flatten(a: Array<File>, b: Array<File>): Array<File> {
  return a.concat(b);
}

function toFilename(file: File): string {
  return file.getName();
}

function isRegExpMatch(pattern: string): (file: File) => boolean {
  return file => {
    return new RegExp(pattern).test(file.getName());
  };
}

function cleanExtension(ext: string): string {
  if (_.startsWith(ext, '.')) {
    return ext.slice(1);
  }
  return ext;
}

/** @class */
class FileHound extends EventEmitter {
  private filters: Array<(args: any) => any>;
  private searchPaths: Array<string>;
  private ignoreDirs: boolean;
  private isMatch: (args: any) => boolean;
  private sync: boolean;
  private directoriesOnly: boolean;
  private negateFilters: boolean;
  private maxDepth: number;

  public constructor() {
    super();
    this.filters = [];
    this.searchPaths = [];
    this.searchPaths.push(process.cwd());
    this.ignoreDirs = false;
    this.isMatch = _.noop;
    this.sync = false;
    this.directoriesOnly = false;
    auto(this);
  }

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
  public static create(): FileHound {
    return new FileHound();
  }

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
  public static any(...args: Array<string>): Promise<Array<string>> {
    return Promise.all(from(args)).reduce(flatten, []);
  }

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
  public modified(pattern): FileHound {
    return this.addFilter(file => {
      const modified = file.lastModifiedSync();
      return isDate(modified).assert(pattern);
    });
  }

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
  public accessed(pattern): FileHound {
    return this.addFilter(file => {
      const accessed = file.lastAccessedSync();
      return isDate(accessed).assert(pattern);
    });
  }

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
  public changed(pattern): FileHound {
    return this.addFilter(file => {
      const changed = file.lastChangedSync();
      return isDate(changed).assert(pattern);
    });
  }

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
  public addFilter(filter): FileHound {
    this.filters.push(filter);
    return this;
  }

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
  public paths(...args): FileHound {
    this.searchPaths = _.uniq(from(args)).map(path.normalize);
    return this;
  }

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
  public path(path): FileHound {
    return this.paths(path);
  }

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
  public discard(...args): FileHound {
    const patterns = from(args);
    patterns.forEach(pattern => {
      this.addFilter(negate(isRegExpMatch(pattern)));
    });
    return this;
  }

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
  public ext(...args): FileHound {
    const extensions = from(args).map(cleanExtension);

    return this.addFilter(file =>
      _.includes(extensions, file.getPathExtension())
    );
  }

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
  public size(sizeExpression): FileHound {
    return this.addFilter(file => {
      const size = file.sizeSync();
      return isNumber(size).assert(sizeExpression);
    });
  }

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
  public isEmpty(): FileHound {
    return this.size(0);
  }

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
  public glob(globPattern): FileHound {
    return this.match(globPattern);
  }

  /**
   * Same as glob
   * @see glob
   */
  public match(globPattern): FileHound {
    return this.addFilter(file => file.isMatch(globPattern));
  }

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
  public not(): FileHound {
    this.negateFilters = true;
    return this;
  }

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
  public ignoreHiddenFiles(): FileHound {
    return this.addFilter(file => !file.isHiddenSync());
  }

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
  public ignoreHiddenDirectories(): FileHound {
    this.ignoreDirs = true;
    return this;
  }

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
  public directory(): FileHound {
    this.directoriesOnly = true;
    return this;
  }

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
  public socket(): FileHound {
    return this.addFilter(file => file.isSocket());
  }

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
  public depth(depth): FileHound {
    this.maxDepth = depth;
    return this;
  }

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
  public find(): Promise<Array<String>> {
    this.initFilters();

    const paths: Array<string> = this.getSearchPaths();
    const searches = Promise.map(paths, this.searchAsync);

    return Promise.all(searches)
      .reduce(flatten)
      .map(toFilename)
      .catch(e => {
        this.emit('error', e);
        throw e;
      })
      .finally(() => this.emit('end'));
  }

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
  public findSync(): Array<string> {
    this.initFilters();

    return this.getSearchPaths()
      .map(this.searchSync)
      .reduce(flatten)
      .map(toFilename);
  }

  public getSearchPaths(): Array<string> {
    const paths = isDefined(this.maxDepth)
      ? this.searchPaths
      : reducePaths(this.searchPaths);

    return copy<Array<string>>(paths);
  }

  private atMaxDepth(root, dir): boolean {
    const depth = dir.getDepthSync() - root.getDepthSync();
    return isDefined(this.maxDepth) && depth > this.maxDepth;
  }

  private shouldFilterDirectory(root, dir): boolean {
    return (
      this.atMaxDepth(root, dir) || (this.ignoreDirs && dir.isHiddenSync())
    );
  }

  private newMatcher(): (any) => boolean {
    const isMatch = compose(this.filters);
    if (this.negateFilters) {
      return negate(isMatch);
    }
    return isMatch;
  }

  private initFilters(): void {
    this.isMatch = this.newMatcher();
  }

  private searchSync(dir: string): Array<File> {
    this.sync = true;
    const root = File.create(dir);
    const trackedPaths = [];
    const files = this.search(root, root, trackedPaths);
    return this.directoriesOnly ? trackedPaths.filter(this.isMatch) : files;
  }

  private searchAsync(dir: string): Promise<Array<File>> {
    const root: File = File.create(dir);
    const trackedPaths: Array<File> = [];
    const pending: Promise<Array<File>> = this.search(root, root, trackedPaths);

    return pending.then(files => {
      if (this.directoriesOnly) return trackedPaths.filter(this.isMatch);

      files.forEach(file => {
        this.emit('match', file.getName());
      });
      return files;
    });
  }

  private search(
    root: File,
    path: File,
    trackedPaths: Array<File>
  ): Promise<Array<File>> {
    if (this.shouldFilterDirectory(root, path)) return [];

    const getFiles = this.sync
      ? path.getFilesSync.bind(path)
      : path.getFiles.bind(path);

    return getFiles()
      .map(file => {
        if (file.isDirectorySync()) {
          if (!this.shouldFilterDirectory(root, file)) trackedPaths.push(file);

          return this.search(root, file, trackedPaths);
        }
        return file;
      })
      .reduce(flatten, [])
      .filter(this.isMatch);
  }
}

export default FileHound;
