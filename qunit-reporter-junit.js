/**
 * JUnit reporter for QUnit v1.0.2pre
 *
 * https://github.com/jquery/qunit-reporter-junit
 *
 * Copyright 2013 jQuery Foundation and other contributors
 * Released under the MIT license.
 * https://jquery.org/license/
 */
(function() {

	'use strict';

	var currentRun = {
	    modules: [],
	    total: 0,
	    passed: 0,
	    failed: 0,
	    start: new Date(),
	    time: 0
	}, currentModule, currentTest, assertCount;

    var path = require('path');

    function getModuleName(module) {
        if (typeof module == 'undefined') {
            return;
        }
        if (typeof module == 'string') {
            return path.basename(module, '.js');
        } else {
            return path.basename(module.path, '.js');
        }
    }

	// Gets called when a report is generated.
	QUnit.jUnitReport = function (/*results, xml*/) {
	    // Override me!
	};

	QUnit.begin(function() {
		currentRun = {
			modules: [],
			total: 0,
			passed: 0,
			failed: 0,
			start: new Date(),
			time: 0
		};
	});

	QUnit.moduleStart(function(data) {
		currentModule = {
			name: data.name,
			tests: [],
			total: 0,
			passed: 0,
			failed: 0,
			start: new Date(),
			time: 0,
			stdout: [],
			stderr: []
		};

		currentRun.modules.push(currentModule);
	});

	QUnit.testStart(function(data) {
		// Setup default module if no module was specified
		if (!currentModule) {
			currentModule = {
				name: getModuleName(data.module) || 'default',
				tests: [],
				total: 0,
				passed: 0,
				failed: 0,
				start: new Date(),
				time: 0,
				stdout: [],
				stderr: []
			};

			currentRun.modules.push(currentModule);
		}

		// Reset the assertion count
		assertCount = 0;

		currentTest = {
			name: data.name,
			failedAssertions: [],
			total: 0,
			passed: 0,
			failed: 0,
			start: new Date(),
			time: 0
		};

		currentModule.tests.push(currentTest);
	});

	QUnit.log(function(data) {
		assertCount++;

		// Ignore passing assertions
		if (!data.result) {
		    var testName = '<none>';
		    if (currentTest) {
		        currentTest.failedAssertions.push(data);
		        testName = currentTest.name;
		    }

		    // Add log message of failure to make it easier to find in Jenkins CI
            if (currentModule) {
                var stdout = currentModule.stdout;
                stdout.push('\nModule: ' + getModuleName(data.module) + ' Test: ' + testName);
                if (data.message) {
                    stdout.push(data.message);
                }

                if (data.source) {
                    stdout.push(data.source);
                }

                if (data.expected != null || data.actual != null) {
                    //it will be an error if data.expected !== data.actual, but if they're
                    //both undefined, it means that they were just not filled out because
                    //no assertions were hit (likely due to code error that would have been logged as source or message).
                    stdout.push('Actual value:');
                    stdout.push(data.actual);
                    stdout.push('Expected value:');
                    stdout.push(data.expected);
                }
		    }
		}
	});

	QUnit.testDone(function(data) {
		currentTest.time = (new Date()).getTime() - currentTest.start.getTime();  // ms
		currentTest.total = data.total;
		currentTest.passed = data.passed;
		currentTest.failed = data.failed;

		currentTest = null;
	});

	QUnit.moduleDone(function(data) {
		currentModule.time = (new Date()).getTime() - currentModule.start.getTime();  // ms
		currentModule.total = data.total;
		currentModule.passed = data.passed;
		currentModule.failed = data.failed;

		currentModule = null;
	});

	QUnit.done(function(data) {
		currentRun.time = data.runtime || ((new Date()).getTime() - currentRun.start.getTime());  // ms
		currentRun.total = data.total;
		currentRun.passed = data.passed;
		currentRun.failed = data.failed;

		generateReport(data, currentRun);
	});

	var generateReport = function(results, run) {
		var pad = function(n) {
			return n < 10 ? '0' + n : n;
		};

		var toISODateString = function(d) {
			return d.getUTCFullYear() + '-' +
				pad(d.getUTCMonth() + 1)+'-' +
				pad(d.getUTCDate()) + 'T' +
				pad(d.getUTCHours()) + ':' +
				pad(d.getUTCMinutes()) + ':' +
				pad(d.getUTCSeconds()) + 'Z';
		};

		var convertMillisToSeconds = function(ms) {
			return Math.round(ms * 1000) / 1000000;
		};

		var xmlEncode = function(text) {
			var baseEntities = {
				'"' : '&quot;',
				'\'': '&apos;',
				'<' : '&lt;',
				'>' : '&gt;',
				'&' : '&amp;'
			};

			return ('' + text).replace(/[<>&\"\']/g, function(chr) {
				return baseEntities[chr] || chr;
			});
		};

		var XmlWriter = function(settings) {
			settings = settings || {};

			var data = [], stack = [], lineBreakAt;

			var addLineBreak = function(name) {
				if (lineBreakAt[name] && data[data.length - 1] !== '\n') {
					data.push('\n');
				}
			};

			lineBreakAt = (function(items) {
				var i, map = {};
				items = items || [];

				i = items.length;
				while (i--) {
					map[items[i]] = {};
				}
				return map;
			})(settings.linebreak_at);

			this.start = function(name, attrs, empty) {
				if (!empty) {
					stack.push(name);
				}

				data.push('<' + name);

				for (var aname in attrs) {
					data.push(' ' + xmlEncode(aname) + '="' + xmlEncode(attrs[aname]) + '"');
				}

				data.push(empty ? ' />' : '>');
				addLineBreak(name);
			};

			this.end = function() {
				var name = stack.pop();
				addLineBreak(name);
				data.push('</' + name + '>');
				addLineBreak(name);
			};

			this.text = function(text) {
				data.push(xmlEncode(text));
			};

			this.cdata = function(text) {
				data.push('<![CDATA[' + text + ']]>');
			};

			this.comment = function(text) {
				data.push('<!--' + text + '-->');
			};
			this.pi = function(name, text) {
				data.push('<?' + name + (text ? ' ' + text : '') + '?>\n');
			};

			this.doctype = function(text) {
				data.push('<!DOCTYPE' + text + '>\n');
			};

			this.getString = function() {
				while (stack.length) {
					this.end();  // internally calls `stack.pop();`
				}
				return data.join('').replace(/\n$/, '');
			};

			this.reset = function() {
				data.length = 0;
				stack.length = 0;
			};

			// Start by writing the XML declaration
			this.pi(settings.xmldecl || 'xml version="1.0" encoding="UTF-8"');
		};


		// Generate JUnit XML report!
		var m, mLen, module, t, tLen, test, a, aLen, assertion, isEmptyElement,
			xmlWriter = new XmlWriter({
				linebreak_at: ['testsuites', 'testsuite', 'testcase', 'failure', 'system-out', 'system-err']
			});

		var name;
		if (typeof window !== 'undefined') {
		    name = window.location && window.location.href;
		}
	    name = name || (run.modules.length === 1 && run.modules[0].name);

		xmlWriter.start('testsuites', {
			name: name || null,
			hostname: 'localhost',
			tests: run.total,
			failures: run.failed,
			errors: 0,
			time: convertMillisToSeconds(run.time),  // ms sec
			timestamp: toISODateString(run.start)
		});

		for (m = 0, mLen = run.modules.length; m < mLen; m++) {
			module = run.modules[m];

			xmlWriter.start('testsuite', {
				id: m,
				name: module.name,
				hostname: 'localhost',
				tests: module.total,
				failures: module.failed,
				errors: 0,
				time: convertMillisToSeconds(module.time),  // ms sec
				timestamp: toISODateString(module.start)
			});

			for (t = 0, tLen = module.tests.length; t < tLen; t++) {
				test = module.tests[t];

				xmlWriter.start('testcase', {
					name: test.name,
					tests: test.total,
					failures: test.failed,
					errors: 0,
					time: convertMillisToSeconds(test.time),  // ms sec
					timestamp: toISODateString(test.start)
				});

				for (a = 0, aLen = test.failedAssertions.length; a < aLen; a++) {
					assertion = test.failedAssertions[a];

					isEmptyElement = assertion && !(assertion.actual && assertion.expected);
					xmlWriter.start('failure', { type: 'AssertionFailedError', message: assertion.message }, isEmptyElement);
					if (!isEmptyElement) {
						xmlWriter.start('actual', { value: assertion.actual }, true);
						xmlWriter.start('expected', { value: assertion.expected }, true);
						xmlWriter.end();  //'failure'
					}
				}

				xmlWriter.end();  //'testcase'
			}

			// Per-module stdout
			if (module.stdout && module.stdout.length) {
				xmlWriter.start('system-out');
				xmlWriter.cdata('\n' + module.stdout.join('\n') + '\n');
				xmlWriter.end();  //'system-out'
			}

			// Per-module stderr
			if (module.stderr && module.stderr.length) {
				xmlWriter.start('system-err');
				xmlWriter.cdata('\n' + module.stderr.join('\n') + '\n');
				xmlWriter.end();  //'system-err'
			}

			xmlWriter.end();  //'testsuite'
		}

		xmlWriter.end();  //'testsuites'


		// Invoke the user-defined callback
		QUnit.jUnitReport({
			results: results,
			xml: xmlWriter.getString()
		});
	};

})();
