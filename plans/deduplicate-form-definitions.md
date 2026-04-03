# Plan: Deduplicate Desktop/Mobile Form Definitions

## Problem

Form definitions are duplicated across desktop and mobile with only minor differences:

| Entity | Desktop File | Mobile File | Difference |
|--------|-------------|-------------|------------|
| PhysioClient | `physio/clients/clients-forms.js` | `m/js/physio/clients-forms.js` | Mobile omits `therapistId` |
| PhysioExercise | `physio/exercises/exercises-forms.js` | `m/js/physio/exercises-forms.js` | Mobile omits 4 fields, renames section |
| TreatmentPlan | `physio/plans/plans-forms.js` | `m/js/physio/plans-forms.js` | Mobile shortens 1 label |
| Appointment | `physio/appointments/appointments-forms.js` | `m/js/physio/appointments-forms.js` | Mobile omits `therapistId` |
| ProgressLog | `physio/progress/progress-forms.js` | `m/js/physio/progress-forms.js` | Mobile shortens 1 label |
| PhysioProtocol | `physio/protocols/protocols-forms.js` | `m/js/physio/protocols-forms.js` | Identical |
| PhysioTherapist | `physio/therapists/therapists-forms.js` | (none) | Desktop only |

Total: ~180 lines duplicated across 13 files.

## Approach

Create a single shared form definitions file that both platforms load. Each platform's enum/namespace file assigns the shared forms to its own namespace. Mobile-specific field omissions are handled by a small post-processing step.

**Why not conditional generation?** The `Layer8FormFactory` produces static form definition objects — there's no platform detection at generation time. The simplest approach is: define the complete (desktop) forms once, then let mobile strip specific fields after loading.

## Phase 1: Create shared form definitions file

**New file:** `physio/physio-forms-shared.js`

This file defines all 7 form definitions on a shared namespace (`window.PhysioSharedForms`) using the desktop enum references. It must load **after** factory components but **before** any platform-specific init file.

The shared file uses `window.Layer8FormFactory` directly (available on both platforms) and references enums via a parameter pattern — each platform passes its own enums object when calling the builder.

```js
// physio/physio-forms-shared.js
(function() {
    'use strict';

    window.PhysioSharedForms = {
        build: function(enums) {
            var f = window.Layer8FormFactory;
            return {
                PhysioClient: f.form('Client', [
                    f.section('Personal Information', [
                        ...f.text('firstName', 'First Name', true),
                        ...f.text('lastName',  'Last Name',  true),
                        ...f.text('email',     'Email'),
                        ...f.text('phone',     'Phone'),
                        ...f.date('dateOfBirth', 'Date of Birth'),
                        ...f.select('status',  'Status', enums.CLIENT_STATUS),
                        ...f.text('referralSource', 'Referral Source'),
                        ...f.reference('therapistId', 'Assigned Therapist', 'PhysioTherapist'),
                        ...f.reference('protocolId',  'Default Protocol',   'PhysioProtocol')
                    ]),
                    f.section('Medical Information', [
                        ...f.textarea('diagnosis',      'Diagnosis'),
                        ...f.textarea('medicalHistory',  'Medical History'),
                        ...f.text('emergencyContact',    'Emergency Contact')
                    ])
                ]),

                PhysioExercise: f.form('Exercise', [
                    f.section('Exercise Details', [
                        ...f.text('name',           'Exercise Name', true),
                        ...f.select('category',     'Category',      enums.EXERCISE_CATEGORY),
                        ...f.select('bodyRegion',   'Body Region',   enums.BODY_REGION),
                        ...f.textarea('description', 'Description'),
                        ...f.text('exerciseAim',    'Exercise Aim'),
                        ...f.checkbox('isActive',   'Active')
                    ]),
                    f.section('Protocol Classification', [
                        ...f.select('joint',         'Joint',         enums.JOINT),
                        ...f.select('posture',       'Posture Type',  enums.POSTURE),
                        ...f.select('phase',         'Phase',         enums.PHYSIO_PHASE),
                        ...f.select('exerciseType',  'Type',          enums.EXERCISE_TYPE),
                        ...f.select('loadType',      'Load Type',     enums.LOAD_TYPE),
                        ...f.text('effort',          'Effort Level'),
                        ...f.text('equipment',       'Equipment'),
                        ...f.text('muscleGroup',     'Muscle Group'),
                        ...f.text('loadNotes',       'Load Notes')
                    ]),
                    f.section('Default Parameters', [
                        ...f.number('defaultSets',        'Default Sets'),
                        ...f.text('defaultReps',          'Default Reps (numeric)'),
                        ...f.text('defaultRepsDisplay',   'Default Reps (display)'),
                        ...f.number('defaultHoldSeconds', 'Hold (seconds)'),
                        ...f.text('movementDirection',    'Movement Direction')
                    ]),
                    f.section('Instructions & Media', [
                        ...f.textarea('instructions',     'Instructions'),
                        ...f.textarea('contraindications', 'Contraindications'),
                        ...f.text('imageStoragePath',     'Image Path'),
                        ...f.text('videoStoragePath',     'Video Path')
                    ])
                ]),

                TreatmentPlan: f.form('Treatment Plan', [
                    f.section('Plan Information', [
                        ...f.text('title',          'Plan Title', true),
                        ...f.reference('clientId',  'Client',     'PhysioClient', true),
                        ...f.select('status',       'Status',     enums.PLAN_STATUS),
                        ...f.date('startDate',      'Start Date'),
                        ...f.date('endDate',        'End Date'),
                        ...f.number('volume',       'Workout Volume (variable exercises per circuit)')
                    ]),
                    f.section('Clinical Details', [
                        ...f.reference('protocolId', 'Protocol Template', 'PhysioProtocol'),
                        ...f.textarea('goals',       'Goals'),
                        ...f.textarea('description', 'Description'),
                        ...f.textarea('therapistNotes', 'Therapist Notes')
                    ])
                ]),

                Appointment: f.form('Appointment', [
                    f.section('Appointment Details', [
                        ...f.reference('clientId',    'Client',    'PhysioClient', true),
                        ...f.reference('therapistId', 'Therapist', 'PhysioTherapist'),
                        ...f.reference('planId',      'Treatment Plan', 'TreatmentPlan'),
                        ...f.date('startTime',   'Start Time', true),
                        ...f.date('endTime',     'End Time'),
                        ...f.select('status',    'Status', enums.APPT_STATUS),
                        ...f.text('location',    'Location')
                    ]),
                    f.section('Notes', [
                        ...f.textarea('therapistNotes', 'Therapist Notes'),
                        ...f.textarea('clientNotes',    'Client Notes')
                    ])
                ]),

                ProgressLog: f.form('Progress Log', [
                    f.section('Log Details', [
                        ...f.reference('clientId', 'Client',         'PhysioClient', true),
                        ...f.reference('planId',   'Treatment Plan', 'TreatmentPlan'),
                        ...f.reference('apptId',   'Appointment',    'Appointment'),
                        ...f.date('logDate',       'Log Date', true),
                        ...f.number('overallPainLevel', 'Overall Pain Level (0-10)')
                    ]),
                    f.section('Notes', [
                        ...f.textarea('generalNotes', 'General Notes')
                    ])
                ]),

                PhysioProtocol: f.form('Protocol Template', [
                    f.section('Protocol Details', [
                        ...f.text('name',            'Protocol Name', true),
                        ...f.text('protocolCode',    'Protocol Code'),
                        ...f.select('joint',         'Joint',         enums.JOINT),
                        ...f.select('posture',       'Posture Type',  enums.POSTURE),
                        ...f.textarea('description', 'Description'),
                        ...f.checkbox('isActive',    'Active')
                    ]),
                    f.section('Exercises', [
                        ...f.inlineTable('exercises', 'Protocol Exercises', [
                            { key: 'protocolExerciseId', label: 'ID',        hidden: true },
                            { key: 'orderIndex',         label: '#',          type: 'number' },
                            { key: 'exerciseId',         label: 'Exercise',   type: 'reference', lookupModel: 'PhysioExercise' },
                            { key: 'exerciseName',       label: 'Name',       type: 'text' },
                            { key: 'sets',               label: 'Sets',       type: 'number' },
                            { key: 'reps',               label: 'Reps',       type: 'text' },
                            { key: 'loadType',           label: 'Load',       type: 'select', options: enums.LOAD_TYPE },
                            { key: 'effort',             label: 'Effort',     type: 'text' },
                            { key: 'loadNotes',          label: 'Load Notes', type: 'text' }
                        ])
                    ])
                ]),

                PhysioTherapist: f.form('Therapist', [
                    f.section('Personal Details', [
                        ...f.text('firstName', 'First Name', true),
                        ...f.text('lastName',  'Last Name',  true),
                        ...f.text('email',     'Email'),
                        ...f.text('phone',     'Phone')
                    ]),
                    f.section('Professional Details', [
                        ...f.text('specialization', 'Specialization'),
                        ...f.text('licenseNumber',  'License Number'),
                        ...f.checkbox('isActive',   'Active')
                    ]),
                    f.section('Audit', [
                        ...f.audit()
                    ])
                ])
            };
        }
    };
})();
```

## Phase 2: Replace desktop form files with thin wrappers

Each desktop form file becomes a one-liner that calls the shared builder with the desktop enums.

**Replace** each of the 7 desktop `*-forms.js` files with:

### `physio/clients/clients-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.PhysioClient = PhysioSharedForms.build(PhysioManagement.enums).PhysioClient;
})();
```

### `physio/exercises/exercises-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.PhysioExercise = PhysioSharedForms.build(PhysioManagement.enums).PhysioExercise;
})();
```

### `physio/plans/plans-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.TreatmentPlan = PhysioSharedForms.build(PhysioManagement.enums).TreatmentPlan;
})();
```

### `physio/appointments/appointments-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.Appointment = PhysioSharedForms.build(PhysioManagement.enums).Appointment;
})();
```

### `physio/progress/progress-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.ProgressLog = PhysioSharedForms.build(PhysioManagement.enums).ProgressLog;
})();
```

### `physio/protocols/protocols-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.PhysioProtocol = PhysioSharedForms.build(PhysioManagement.enums).PhysioProtocol;
})();
```

### `physio/therapists/therapists-forms.js`
```js
(function() {
    'use strict';
    PhysioManagement.forms = PhysioManagement.forms || {};
    PhysioManagement.forms.PhysioTherapist = PhysioSharedForms.build(PhysioManagement.enums).PhysioTherapist;
})();
```

**Optimization:** Since all 7 wrappers call `.build()` separately (wasteful — builds all 7 forms 7 times), a better pattern is a single desktop init file. But keeping individual files preserves the existing script loading structure in app.html. An alternative is to replace all 7 with one file:

### Alternative: single `physio/physio-forms.js`
```js
(function() {
    'use strict';
    var all = PhysioSharedForms.build(PhysioManagement.enums);
    Object.keys(all).forEach(function(k) {
        PhysioManagement.forms = PhysioManagement.forms || {};
        PhysioManagement.forms[k] = all[k];
    });
})();
```

Then remove the 7 individual form script tags from `app.html` and replace with one:
```html
<script src="physio/physio-forms.js"></script>
```

## Phase 3: Replace mobile form files with thin wrappers + field stripping

Mobile needs to remove a few fields. A small utility strips fields by key from a built form:

### `m/js/physio/physio-forms-mobile.js`
```js
(function() {
    'use strict';
    var enums = MobilePhysioManagement.enums;
    var all = PhysioSharedForms.build(enums);

    // Strip fields that don't apply on mobile
    _removeFields(all.PhysioClient, ['therapistId']);
    _removeFields(all.PhysioExercise, ['exerciseAim', 'muscleGroup', 'imageStoragePath', 'videoStoragePath']);
    _renameSection(all.PhysioExercise, 'Instructions & Media', 'Instructions');
    _relabel(all.TreatmentPlan, 'volume', 'Workout Volume');
    _removeFields(all.Appointment, ['therapistId']);
    _relabel(all.ProgressLog, 'overallPainLevel', 'Pain Level (0-10)');

    Object.keys(all).forEach(function(k) {
        MobilePhysioManagement.forms = MobilePhysioManagement.forms || {};
        MobilePhysioManagement.forms[k] = all[k];
    });

    function _removeFields(formDef, keys) {
        if (!formDef || !formDef.sections) return;
        formDef.sections.forEach(function(section) {
            section.fields = section.fields.filter(function(field) {
                return keys.indexOf(field.key) === -1;
            });
        });
        // Remove empty sections
        formDef.sections = formDef.sections.filter(function(s) {
            return s.fields.length > 0;
        });
    }

    function _renameSection(formDef, oldTitle, newTitle) {
        if (!formDef || !formDef.sections) return;
        formDef.sections.forEach(function(s) {
            if (s.title === oldTitle) s.title = newTitle;
        });
    }

    function _relabel(formDef, fieldKey, newLabel) {
        if (!formDef || !formDef.sections) return;
        formDef.sections.forEach(function(s) {
            s.fields.forEach(function(f) {
                if (f.key === fieldKey) f.label = newLabel;
            });
        });
    }
})();
```

## Phase 4: Update script tags

### Desktop `app.html`

**Add** (after physio-config.js, before column files):
```html
<script src="physio/physio-forms-shared.js"></script>
<script src="physio/physio-forms.js"></script>
```

**Remove** these 7 lines:
```html
<script src="physio/therapists/therapists-forms.js"></script>
<script src="physio/clients/clients-forms.js"></script>
<script src="physio/exercises/exercises-forms.js"></script>
<script src="physio/protocols/protocols-forms.js"></script>
<script src="physio/plans/plans-forms.js"></script>
<script src="physio/appointments/appointments-forms.js"></script>
<script src="physio/progress/progress-forms.js"></script>
```

### Mobile `m/app.html`

**Add** (after enums, before columns):
```html
<script src="../physio/physio-forms-shared.js"></script>
<script src="js/physio/physio-forms-mobile.js"></script>
```

**Remove** these 6 lines:
```html
<script src="js/physio/clients-forms.js"></script>
<script src="js/physio/exercises-forms.js"></script>
<script src="js/physio/plans-forms.js"></script>
<script src="js/physio/appointments-forms.js"></script>
<script src="js/physio/progress-forms.js"></script>
<script src="js/physio/protocols-forms.js"></script>
```

## Phase 5: Delete redundant files

### Desktop (delete 7 files):
- `physio/clients/clients-forms.js`
- `physio/exercises/exercises-forms.js`
- `physio/plans/plans-forms.js`
- `physio/appointments/appointments-forms.js`
- `physio/progress/progress-forms.js`
- `physio/protocols/protocols-forms.js`
- `physio/therapists/therapists-forms.js`

### Mobile (delete 6 files):
- `m/js/physio/clients-forms.js`
- `m/js/physio/exercises-forms.js`
- `m/js/physio/plans-forms.js`
- `m/js/physio/appointments-forms.js`
- `m/js/physio/progress-forms.js`
- `m/js/physio/protocols-forms.js`

## Phase 6: Verification

1. Load desktop app — navigate to each service, click a row, verify detail popup shows all fields correctly
2. Load mobile app — navigate to each service, click a card, verify detail shows correct fields
3. Verify mobile omissions:
   - PhysioClient detail: no "Assigned Therapist" field
   - PhysioExercise detail: no "Exercise Aim", "Muscle Group", "Image Path", "Video Path"; section titled "Instructions" not "Instructions & Media"
   - Appointment detail: no "Therapist" field
   - TreatmentPlan detail: volume label is "Workout Volume" (not "Workout Volume (variable exercises per circuit)")
   - ProgressLog detail: pain label is "Pain Level (0-10)" (not "Overall Pain Level (0-10)")
4. Verify protocol inline table works on both platforms (exercise rows, loadType select dropdown)

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Form definition files | 13 | 3 |
| Total form definition lines | ~280 | ~160 |
| Places to update when adding a field | 2 (desktop + mobile) | 1 (shared) |
| Mobile-specific differences | Scattered across 6 files | Centralized in 1 file |
