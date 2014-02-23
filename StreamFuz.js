var stream  = require('stream')
  , util    = require('util')
  , async   = require('async')
  , _       = require('underscore')
  , crypto  = require('crypto')

var StreamFuz = module.exports = function (options) {
  var self = this;
  this.parallel       = options && options.parallel ? options.parallel : 1;
  this.bufferSize     = options && options.bufferSize ? options.bufferSize : 16384;
  this.streams        = options && options.streams ? options.streams : [];
  this.inProgress     = [];
  this.started        = false;
  this.hash           = crypto.createHash('md5');
  this.resolving;

  stream.PassThrough.call(this, options);
};

util.inherits(StreamFuz, stream.PassThrough);

StreamFuz.prototype.enqueue = function(stream) {
  if(_.isArray(stream))
    this.streams = this.streams.concat(stream);
  else
    this.streams.push(stream);
}

StreamFuz.prototype.pipe = function(dest, options) {
  this.startTime = new Date().getTime();
  this.bytesPiped = 0;
  // simple, 
  // take the active, pipe it out.  when it's done, pipe the next.
  if(!this.started) 
    this._next();

  return stream.PassThrough.prototype.pipe.apply(this, arguments)
}

StreamFuz.prototype.push = function(chunk) {
  if(chunk) {
    this.bytesPiped += chunk.length;
    this.hash.update(chunk);  
  }
  
  return stream.PassThrough.prototype.push.apply(this, arguments) 
}


StreamFuz.prototype.end = function() {
  var self = this;
  // a stream has ended.
  // lets pipe the next one, if there is one.

  // we're done
  this.inProgress[0].unpipe(this);
  // toss this one off the front.
  this.inProgress.shift();

  // start the next
  if(!this._next()) {
    // oh wait, no next.  ok, we're completely done.
    if(process.env.DEBUG == 'true')
      console.log('StreamFuz total throughput', this._calcThroughput(this.startTime, this.bytesPiped));

    // signal end by calling the default PassThrough end().
    self.once('finish', function() {
      self.hash = self.hash.digest('hex');  
    })
    stream.PassThrough.prototype.end.apply(this, arguments);
  }
}

StreamFuz.prototype._next = function() {
  var that = this;

  if(this.inProgress.length == 0 && this.resolving) {
    // we're in the middle of a resolve already.
    // we'll just register once for a _next, and be done.
    this.once('_resolved', this._next);
    return true;
  }

  if(!this.inProgress.length && !this.streams.length && this.started) {
    // all of our streams are empty.  we're done.
    return false;
  }

  if(this.inProgress.length > 0) {
    // we've got streams waiting in our inProgress queue.
    // just pipe them directly.
    this.inProgress[0].pipe(this);

    // (don't forget to fill up the buffer of parallel streams)
    this._resolveParallelBuffer();
  }
  else {
    // we haven't got any streams that are already started.
    // we need to start up a stream.
    // we'll resolve ONE stream and immediately pipe that out.
    // then, we'll resolve the rest (the this.parallel other streams)
    this._resolve(this.streams.shift(), function(err, resolved) {

      // start the first stream.
      that.inProgress[0] = resolved;

      // pipe it.
      that.inProgress[0].pipe(that);

      // mark us as started
      that.started = true;

      // get the rest of our streams going, up to this.parallel
      that._resolveParallelBuffer();
    })
  }

  return true;
}

StreamFuz.prototype._resolveParallelBuffer = function(callback) {
  var that = this;
  if(this.resolving) {
    // already doing it.  no point in doing it again.
    return;
  }

  if(that.streams.length == 0) {
    // we have nothing to resolve, so we're done.
    return;
  }

  if(that.inProgress.length >= that.parallel) {
    // we've already got our maximum number of items being streamed.
    return;
  }

  this.resolving = _.first(this.streams, that.parallel - that.inProgress.length);
  this.streams = _.rest(this.streams, that.parallel - that.inProgress.length)

  async.map(this.resolving, function(item, callback) {
    // resolve each item.
    that._resolve(item, callback) 
  }
  , function(err, resolvedArray) {
    // once they're resolved, push them on to the inProgress queue.
    // (we have to push them all at once so that we don't get out of order)
    that.inProgress = that.inProgress.concat(resolvedArray);
    // clear out our 'resolving' array - we're no longer resolving anything.
    that.resolving = undefined;
    // in case anyone cares, let them know that we're done.
    that.emit('_resolved');
  })
}

StreamFuz.prototype._resolve = function(streamToResolve, callback) {
  var that = this;
  var bufferStream = function(streamToBuffer, callback) {
    var p = new stream.PassThrough({highWaterMark: that.bufferSize});
    streamToBuffer.pipe(p);
    callback(null, p);
  }

  if(typeof streamToResolve === 'function'){
    streamToResolve(function(err, resolvedStream) {
      if(err) return callback(err);
      bufferStream(resolvedStream, callback);
    });
  }
  else {
    bufferStream(streamToResolve, callback);
  }
}

StreamFuz.prototype._calcThroughput = function(startTime, bytes) {
  var totalMs = new Date().getTime() - startTime
    , throughput = Math.round((bytes / 1024) / (totalMs / 1000))
    ;
  return throughput + ' kilobytes per second'
}

exports.StreamFuz = StreamFuz;
