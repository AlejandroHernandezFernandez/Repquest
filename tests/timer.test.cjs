const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
let now = Date.now(), failSave = false;
const storage = new Map(), intervals = new Map(), elements = new Map();
let nextId = 0;
const node = () => ({textContent:'',innerHTML:'',classList:{add(){},remove(){}},close(){},showModal(){}});
const context = vm.createContext({
  Date: class extends Date { static now() { return now; } },
  localStorage: {getItem:k=>storage.get(k),setItem:(k,v)=>{if(failSave)throw Error('full');storage.set(k,v);}},
  document: {querySelector:s=>elements.get(s)||null,getElementById:id=>elements.get('#'+id)||null,querySelectorAll:()=>[],addEventListener(){}},
  window:{scrollTo(){},addEventListener(){}},navigator:{},crypto:{randomUUID:()=>String(++nextId)},
  setInterval:fn=>{const id=++nextId;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
  setTimeout:()=>0,clearTimeout(){},console
});
const run = code => vm.runInContext(code,context);
vm.runInContext(fs.readFileSync(path.join(root,'dist/timer.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'dist/app.js'),'utf8').replace(/^render\(\);$/m,''),context);
run('render = () => syncTimer(); show = () => {}; close = () => {};');
elements.set('#celebrate',node());elements.set('#toast',node());
assert.equal(run('formatDuration(3665)'),'1:01:05');
assert.equal(run('formatDuration(0)'),'0:00:00');
assert.equal(run('formatDuration(90061)'),'25:01:01');
assert.equal(run(`getElapsedSeconds(${now+1000})`),0);
run("start('Push')");
assert.equal(run('data.draft.startedAt'),now);
const originalStart=now;
now+=1500000;
elements.set('#workout-timer',node());run('syncTimer()');
assert.equal(elements.get('#workout-timer').textContent,'0:25:00');
run('syncTimer();syncTimer()');assert.equal(intervals.size,1);
elements.delete('#workout-timer');run('syncTimer()');assert.equal(intervals.size,0);
now+=300000;
elements.set('#workout-timer',node());run('syncTimer()');
assert.equal(elements.get('#workout-timer').textContent,'0:30:00');
// Simulate reopening: recover saved draft rather than resetting its timestamp.
run("data=JSON.parse(localStorage.getItem('repquest-v1'));validate(data);syncTimer()");
assert.equal(run('data.draft.startedAt'),originalStart);
assert.equal(elements.get('#workout-timer').textContent,'0:30:00');
run('data.draft.exercises[0].sets[0]={weight:100,reps:8,done:true};');
failSave=true;run('finish()');assert.equal(run('data.sessions.length'),0);assert.ok(run('data.draft'));
failSave=false;run('finish()');
assert.equal(run('data.sessions[0].durationSeconds'),1800);
assert.equal(run('data.draft'),null);assert.equal(intervals.size,0);
now+=60000;assert.equal(run('data.sessions[0].durationSeconds'),1800);
const before=run('JSON.stringify(data.sessions)');
run("data.draft={name:'Legacy workout',date:today(),exercises:[{name:'Squat',sets:[{weight:80,reps:5,done:true}]}]};validate(data)");
assert.match(run('workoutClock(data.draft)'),/Start timer now/);
run('finish()');assert.equal(run('data.sessions[1].durationSeconds'),undefined);
assert.equal(run('JSON.stringify(data.sessions.slice(0,1))'),before);
// Optional fields preserve old backups and reject malformed timing data.
run("validate({version:1,sessions:[],weights:[],goal:4,unit:'lb',draft:null})");
assert.throws(()=>run("validateTiming({draft:{startedAt:'bad'},sessions:[]})"));
assert.throws(()=>run("validateTiming({sessions:[{durationSeconds:-1}]})"));
run("data.draft={name:'Old draft',date:today(),exercises:[]};");
elements.set('#start-timer',node());run('syncTimer()');elements.get('#start-timer').onclick();
assert.equal(run('data.draft.startedAt'),now);
run("data.draft=null;syncTimer()");assert.equal(intervals.size,0);
console.log('Timer checks passed: formatting, background time, reload, single interval, finish, save failure, legacy data, validation, discard.');
