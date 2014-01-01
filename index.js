
var bind = require('event-component').bind
var Progress = require('progress-svg')
var escape = require('escape-html')
var classes = require('classes')
var domify = require('domify')
var text = require('text')

/**
 * Save timer references because some testing tools
 * mess with them
 */

var global = function(){return this}()
var Date = global.Date

/**
 * Expose `HTML`.
 */

exports = module.exports = HTML

/**
 * Stats template.
 */

var statsTemplate = '<ul id="hydro-stats">'
  + '<li class="progress"></li>'
  + '<li class="passes"><a href="#">passes:</a> <em>0</em></li>'
  + '<li class="failures"><a href="#">failures:</a> <em>0</em></li>'
  + '<li class="duration">duration: <em>0</em>s</li>'
  + '</ul>'

/**
 * Initialize a new `HTML` reporter.
 *
 * @param {Hydro} hydro
 * @param {Element} root
 * @api public
 */

function HTML(hydro, root){}

HTML.prototype.use = function(hydro, root){
  var self = this
  var stats = track(hydro)
  var stat = domify(statsTemplate)
  var items = stat.getElementsByTagName('li')
  var passes = items[1].getElementsByTagName('em')[0]
  var passesLink = items[1].getElementsByTagName('a')[0]
  var failures = items[2].getElementsByTagName('em')[0]
  var failuresLink = items[2].getElementsByTagName('a')[0]
  var duration = items[3].getElementsByTagName('em')[0]
  var progress = new Progress().size(40).text('%d%')
  var report = domify('<ul id=hydro-report></ul>')
  var stack = [report]

  root = root 
    || document.getElementById('hydro')
    || document.body.appendChild(domify('<div id=hydro></div>'))

  items[0].appendChild(progress.el)
  root.appendChild(stat)
  root.appendChild(report)

  // pass toggle
  bind(passesLink, 'click', function(){
    unhide()
    var name = /pass/.test(report.className) ? '' : ' pass'
    report.className = report.className.replace(/fail|pass/g, '') + name
    if (report.className.trim()) hideSuitesWithout('test pass')
  })

  // failure toggle
  bind(failuresLink, 'click', function(){
    unhide()
    var name = /fail/.test(report.className) ? '' : ' fail'
    report.className = report.className.replace(/fail|pass/g, '') + name
    if (report.className.trim()) hideSuitesWithout('test fail')
  })

  hydro.on('pre:suite', function(suite){
    // suite
    var url = self.suiteURL(suite)
    var el = fragment('<li class="suite"><h1><a href="%s">%e</a></h1></li>', url, suite.title)

    // container
    stack[0].appendChild(el)
    stack.unshift(document.createElement('ul'))
    el.appendChild(stack[0])
  })

  hydro.on('post:suite', function(suite){
    stack.shift()
  })

  hydro.on('post:test', function(test){
    progress.update(stats.percent)

    // update stats
    text(passes, stats.passes)
    text(failures, stats.failures)
    text(duration, (stats.elapsed / 1000).toFixed(2))

    // test
    switch (test.status) {
      case 'passed':
        var el = fragment(
          '<li class="test pass %s"><h2>%e<span class=duration>%sms</span></h2></li>',
          test.speed || 'fast',
          test.title,
          test.time)
        break
      case 'pending':
      case 'skipped':
        var el = fragment(
          '<li class="test pass pending"><h2>%e</h2></li>',
          test.title)
        break
      case 'failed':
        var str = test.error.stack || test.error.toString()

        // FF / Opera do not add the message
        if (!~str.indexOf(test.error.message)) {
          str = test.error.message + '\n' + str
        }

        // <=IE7 stringifies to [Object Error]. Since it can be overloaded, we
        // check for the result of the stringifying.
        if ('[object Error]' == str) str = test.error.message

        // Safari doesn't give you a stack. Let's at least provide a source line.
        if (!test.error.stack && test.error.sourceURL && test.error.line !== undefined) {
          str += "\n(" + test.error.sourceURL + ":" + test.error.line + ")"
        }

        var el = fragment(
          '<li class="test fail"><h2>%e</h2><pre class=error>%e</pre></li>',
          test.title,
          str)
    }

    // hide code
    if (test.status != 'pending') {
      var h2 = el.getElementsByTagName('h2')[0]
      bind(h2, 'click', function(){
        pre.style.display = 'none' == pre.style.display
          ? 'block'
          : 'none'
      })
      var pre = fragment('<pre><code>%e</code></pre>', clean(test.fn.toString()))
      el.appendChild(pre)
      pre.style.display = 'none'
    }

    // Don't call .appendChild if #hydro-report was already
    // .shift()'ed off the stack.
    if (stack[0]) stack[0].appendChild(el)
  })
}

function track(hydro){
  var stats = {
    pending: 0,
    tests: 0,
    passes: 0,
    failures: 0,
    total: hydro.tests().length
  }

  hydro.on('post:test', function(test){
    stats.percent = (++stats.tests / stats.tests) * 100 | 0
    stats.elapsed = new Date - stats.start
    switch (test.status) {
      case 'pending':
      case 'skipped':
        stats.pending++
        break
      case 'passed':
        stats.passes++
        break
      case 'failed':
        stats.failures++
    }
  })

  hydro.on('pre:all', function() {
    stats.start = new Date
    stats.tests = hydro.tests().length
  })

  hydro.on('post:all', function(){
    stats.end = new Date
    stats.duration = Number(stats.end) - Number(stats.start)
  })

  return stats
}

/**
 * Provide suite URL
 *
 * @param {Object} [suite]
 */

HTML.prototype.suiteURL = function(suite){
  // TODO: fullTitle
  return '?grep=' + encodeURIComponent(suite.title)
}

/**
 * Return a DOM fragment from `html`.
 */

function fragment(html) {
  var args = arguments
  var i = 1
  return domify(html.replace(/%([se])/g, function(_, type){
    switch (type) {
      case 's': return String(args[i++])
      case 'e': return escape(args[i++])
    }
  }))
}

/**
 * Check for suites that do not have elements
 * with `classname`, and hide them.
 */

function hideSuitesWithout(classname) {
  var suites = document.getElementsByClassName('suite')
  for (var i = 0; i < suites.length; i++) {
    var suite = suites[i]
    var els = suite.getElementsByClassName(classname)
    if (!els.length) classes.add('hidden', suite)
  }
}

/**
 * Unhide .hidden suites.
 */

function unhide() {
  var els = document.getElementsByClassName('suite hidden')
  for (var i = 0; i < els.length; ++i) classes.remove('hidden', els[i])
}

/**
 * Strip the function definition from `str`
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function clean(str) {
  str = str
    .replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, '')
    .replace(/^function *\(.*\) *{/, '')
    .replace(/\s+\}$/, '')

  var spaces = str.match(/^\n?( *)/)[1].length
  var tabs = str.match(/^\n?(\t*)/)[1].length
  var re = new RegExp(''
    + '^\n?' + (tabs ? '\t' : ' ')
    + '{' + (tabs || spaces) + '}', 'gm')

  return str.replace(re, '').trim()
}
