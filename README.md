StreamFuz - Simple Node.js Stream Combiner/Merger
=========

**StreamFuz** is a stream utility that will take a list of smaller streams and merge them into a single, large stream.  It fully supports all Node.js [Streams2](http://nodejs.org/api/stream.html) functionality, including piping and back-pressure.

Installation
------------

```bash
npm install streamfuz
```

Use
---

StreamFuz is [Readable](http://nodejs.org/api/stream.html#stream_class_stream_readable) stream (actually, technically, it's a PassThrough right now, but nevermind).  That means that you can pipe the output of StreamFuz to any other Writable stream, or you can just `read()` from it directly.

StreamFuz takes all of the typical [Readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable) options on creation, in addition to the following: 
- `parallel`: Number of parallel part streams to be reading from simultaneously. If you're using StreamFuz to combine resources that are not local, it is useful (and faster) to parallelize the work.  Defaults to 1 (no parallelization).
- `bufferSize`: Amount of buffering per part.  If you're reading a few streams in parallel, you'll need to buffer at least a small amount (otherwise there's no point in parllelizing, right).  Defaults to 16384.

Once you've created your StreamFuz stream, you need to enqueue up the parts that are to be combined.
- 'enqueue(stream)': Adds a single stream to the queue of parts that are waiting to be merged in.
- 'enqueue([array of streams])': Appends an ordered array of streams to the end of the queue of streams.

So, briefly, usage looks something like this:

```javascript
var streams = [];
for(var i = 0; i < 10; i++)
  streams.push(fs.createReadStream('/tmp/read_stream_' + i + '.txt'));

var streamFuz = new StreamFuz({ parallel: 3, bufferSize: 50000 });
streamFuz.enqueue(streams);

var writeStream = fs.createWriteStream('/tmp/output_stream.txt');
streamFuz.pipe(writeStream);
```

Licence
-------
MIT
