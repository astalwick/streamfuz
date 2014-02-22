var assert      = require("assert")
  , stream      = require('stream')
  , should      = require('should')
  , seedrandom  = require('seedrandom')
  , crypto      = require('crypto')
  , util        = require('util')

  , StreamFuz   = require("../StreamFuz")

function FakeReadableStream(options) {
  var self = this;
  this.maxLength = options.maxLength;
  this.totalWritten = 0;
  this.hash = crypto.createHash('md5');

  this.on('end', function() {
    self.hash = self.hash.digest('hex');
  })
  Math.seedrandom(options.seed || 1);
  stream.Readable.call(this, options)
}

util.inherits(FakeReadableStream, stream.Readable);

FakeReadableStream.prototype._read = function(size) {
  if(this.totalWritten + size > this.maxLength)
    size = this.maxLength - this.totalWritten;

  if(size <= 0) {
    this.push(null);
    return;
  }

  var buf = new Buffer(size)
    , written = 0
    ;

  while(written < size) {
    buf.writeUInt8(Math.floor(Math.random()*256), written);
    written++;
  }

  this.totalWritten += written;
  this.hash.update(buf);
  this.push(buf);
}

function FakeWritableStream(options) {
  var self = this;
  options = options || {};
  this.writeDelay = options.writeDelay;
  this.hash = crypto.createHash('md5');

  this.on('finish', function() {
    self.hash = self.hash.digest('hex');
  })  
  stream.Writable.call(this, options);
}
util.inherits(FakeWritableStream, stream.Writable);

FakeWritableStream.prototype._write = function(chunk, encoding, callback) {
  this.hash.update(chunk);
  if(this.writeDelay)
    setTimeout(callback, this.writeDelay)
  else
    setImmediate(callback);
}



function newStreams(number, length, seed) {
  var ret = []
  for(var i = 0; i < number; i++){
    ret.push(new FakeReadableStream({ maxLength: (i + 1) * length }));
  }

  return ret;
}

function basicMergeHelper(options, done) {
  var s = new StreamFuz({
    parallel: options.parallel
  , bufferSize: options.bufferSize
  });

  var p = new FakeWritableStream();
  s.enqueue(newStreams(options.numberOfStreams, options.lengthOfStreams, options.seed || 1));
  p.on('finish', function(){
    done();
    p.hash.should.equal(s.hash)
  });

  s.pipe(p);
}

describe('StreamFuz', function(){
  it('should have sane defaults', function() {
    var s = new StreamFuz()
    s.should.have.property('parallel');
    s.should.have.property('bufferSize');
    s.bufferSize.should.be.above(1024);
    s.parallel.should.be.below(50);
  });

  it('should not be started', function() {
    var s = new StreamFuz();
    s.should.have.property('started');
    s.started.should.equal(false);
  })

  it('should accept optional parallelism and bufferSize properties', function() {
    var s = new StreamFuz({parallel: 15, bufferSize: 10000})
    s.should.have.property('parallel');
    s.should.have.property('bufferSize');
    s.bufferSize.should.equal(10000);
    s.parallel.should.equal(15);
  })

  it('should accept enqueueing individual streams or functions AND arrays', function() {
    var s = new StreamFuz();
    s.enqueue(new stream.PassThrough());

    s.should.have.property('streams');
    s.streams.should.have.length(1);

    s.enqueue(function() {return new stream.PassThrough()});
    s.streams.should.have.length(2);

    var ar = [new stream.PassThrough(), function() {return new stream.PassThrough()}]
    s.enqueue(ar);
    s.streams.should.have.length(4);

    s.streams[0].should.be.instanceOf(stream.PassThrough);
    s.streams[1].should.be.type('function');
    s.streams[2].should.be.instanceOf(stream.PassThrough);
    s.streams[3].should.be.type('function');
  })

  it('should merge short streams with defaults', function(done) {
    basicMergeHelper({
      numberOfStreams: 15
    , lengthOfStreams: 10
    }, done)

  });

  it('should merge short streams with parallel 1', function(done) {
    basicMergeHelper({
      numberOfStreams: 15
    , lengthOfStreams: 10
    , parallel: 1
    }, done)
  });  

  it('should merge short streams with parallel 100', function(done) {
    basicMergeHelper({
      numberOfStreams: 15
    , lengthOfStreams: 10
    , parallel: 100
    }, done)
  });    

  it('should merge short streams with bufferSize 10', function(done) {
    basicMergeHelper({
      numberOfStreams: 15
    , lengthOfStreams: 10
    , bufferSize: 10
    }, done)
  });    

  it('should merge short streams with bufferSize 100000', function(done) {
    basicMergeHelper({
      numberOfStreams: 15
    , lengthOfStreams: 10
    , bufferSize: 100000
    }, done)
  });

  it('should merge LOTS of short streams', function(done) {
    basicMergeHelper({
      numberOfStreams: 300
    , lengthOfStreams: 10
    }, done)
  });  


  it('should merge long streams with parallel 1', function(done) {
    basicMergeHelper({
      numberOfStreams: 5
    , lengthOfStreams: 10000
    , parallel: 1
    }, done)
  });  

  it('should merge long streams with parallel 100', function(done) {
    basicMergeHelper({
      numberOfStreams: 5
    , lengthOfStreams: 10000
    , parallel: 100
    }, done)
  });      

  it('should merge long streams with bufferSize 1024', function(done) {
    basicMergeHelper({
      numberOfStreams: 5
    , lengthOfStreams: 10000
    , bufferSize: 1024
    }, done)
  });    

  it('should merge long streams with bufferSize 100000', function(done) {
    basicMergeHelper({
      numberOfStreams: 5
    , lengthOfStreams: 10000
    , bufferSize: 100000
    }, done)
  });  


  it('should work even if only one stream is supplied', function(done) {
    basicMergeHelper({
      numberOfStreams: 1
    , lengthOfStreams: 10000
    }, done)
  });   
})