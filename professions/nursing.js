// Nursing · Writing and Speaking material for the OET Prep Course (all case notes, letters and role-plays are original).
// To add another profession, copy this file (e.g. professions/medicine.js), keep the same shape, change the id and the
// material, add a <script> tag for it in index.html and set CONFIG.PROFESSION. Listening and Reading are shared by all professions.
(window.PROFESSIONS=window.PROFESSIONS||{}).nursing={
  id:'nursing', name:'Nursing', role:'nurse', reader:'Nurse',
  // letters: case notes for the Writing tools (key → task)
  letters:{},
  // roleplays: candidate card + interlocutor card for the Speaking tools
  roleplays:{},
  // samples: colour-coded model letters shown in the Writing sessions
  samples:{},
  // letterTasks: short case-note tasks the teacher can send through Messages
  letterTasks:[]
};
