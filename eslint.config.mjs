// Development only: check ES5 grammar and common runtime mistakes.
export default [{ ignores: ['app/standby/vendor/**'] }, {
  files: ['app/**/*.js'],
  languageOptions: {
    ecmaVersion: 5,
    sourceType: 'script',
    globals: {
      window: 'readonly', document: 'readonly', Image: 'readonly', localStorage: 'readonly',
      setTimeout: 'readonly', clearTimeout: 'readonly', Promise: 'readonly',
      FrameDevice: 'readonly', tizen: 'readonly'
    }
  },
  rules: {
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-unreachable': 'error',
    'no-constant-condition': 'error',
    'no-dupe-args': 'error',
    'no-dupe-keys': 'error',
    'no-duplicate-case': 'error',
    'no-func-assign': 'error',
    'no-global-assign': 'error',
    'no-unexpected-multiline': 'error',
    'valid-typeof': 'error',
    eqeqeq: ['error', 'always']
  }
}, {
  // Zürich HB standby map (app/standby): browser APIs and its own script globals.
  files: ['app/standby/js/**/*.js'],
  languageOptions: {
    globals: {
      fetch: 'readonly', setInterval: 'readonly', clearInterval: 'readonly', location: 'readonly', Path2D: 'readonly',
      Float64Array: 'readonly', Int32Array: 'readonly', maplibregl: 'readonly',
      HBConfig: 'readonly', HBMapStyle: 'readonly', Rails: 'readonly', Trains: 'readonly', Planes: 'readonly', ISS: 'readonly', TrainIcons: 'readonly'
    }
  }
}];
