const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ActionRouter = require('../../core/assistant/automation/ActionRouter');
const ProfileFacts = require('../../core/assistant/knowledge/ProfileFacts');
const FormAutomation = require('../../plugins/forms');
const { SettingsService } = require('../../apps/desktop/settings');

const PROFILE = {
  fullName: 'Rakesh Kumar',
  firstName: 'Rakesh',
  middleName: '',
  lastName: 'Kumar',
  dateOfBirth: '1990-05-15',
  gender: 'male',
  nationality: 'Indian',
  email: 'rakesh@example.com',
  phone: '+919876543210',
  username: 'rakesh_k',
  website: 'https://rakesh.dev',
  linkedin: 'linkedin.com/in/rakesh',
  github: 'github.com/rakesh',
  twitter: '@rakesh',
  company: 'Acme Corp',
  jobTitle: 'Software Engineer',
  department: 'Engineering',
  role: 'Engineer',
  addressLine1: '123 Main St',
  addressLine2: 'Apt 4B',
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'India'
};

function routerWithProfile(profile = PROFILE) {
  const config = {
    assistant: { userProfile: profile },
    permissions: { levels: { low: { requiresConfirmation: false, requiresAuth: false } } }
  };
  const engine = {
    execute(actionId, entities) {
      return { success: true, data: { actionId, ...entities } };
    }
  };
  return new ActionRouter(config, engine);
}

describe('Profile Facts helpers', function() {

  it('should map the full profile into flat user facts for form filling', function() {
    const facts = ProfileFacts.profileToFacts(PROFILE);
    assert.equal(facts.name, 'Rakesh Kumar');
    assert.equal(facts.fullName, 'Rakesh Kumar');
    assert.equal(facts.firstName, 'Rakesh');
    assert.equal(facts.lastName, 'Kumar');
    assert.equal(facts.email, 'rakesh@example.com');
    assert.equal(facts.emailAddress, 'rakesh@example.com');
    assert.equal(facts.phoneNumber, '+919876543210');
    assert.equal(facts.profession, 'Software Engineer');
    assert.equal(facts.occupation, 'Software Engineer');
    assert.equal(facts.workplace, 'Acme Corp');
    assert.equal(facts.location, '123 Main St, Apt 4B');
    assert.equal(facts.zipCode, '560001');
    assert.equal(facts.zipcode, '560001');
    assert.equal(facts.age, String(new Date().getFullYear() - 1990 - (new Date().getMonth() < 4 ? 1 : 0)));
    assert.equal(facts.github, 'github.com/rakesh');
    assert.equal(facts.linkedin, 'linkedin.com/in/rakesh');
  });

  it('should keep empty profile fields out of the fact map', function() {
    const facts = ProfileFacts.profileToFacts({ fullName: 'Rakesh' });
    assert.equal(facts.fullName, 'Rakesh');
    assert.equal(facts.email, undefined);
    assert.equal(facts.github, undefined);
  });

  it('should resolve profile fields by many aliases', function() {
    assert.deepEqual(ProfileFacts.resolveProfileField(PROFILE, 'my email'), { key: 'email', label: 'Email', value: 'rakesh@example.com' });
    assert.deepEqual(ProfileFacts.resolveProfileField(PROFILE, 'phone number'), { key: 'phone', label: 'Phone', value: '+919876543210' });
    assert.deepEqual(ProfileFacts.resolveProfileField(PROFILE, 'my job title'), { key: 'jobTitle', label: 'Job Title', value: 'Software Engineer' });
    assert.deepEqual(ProfileFacts.resolveProfileField(PROFILE, 'date of birth'), { key: 'dateOfBirth', label: 'Date of Birth', value: '1990-05-15' });
    assert.deepEqual(ProfileFacts.resolveProfileField(PROFILE, 'postal code'), { key: 'postalCode', label: 'Postal Code', value: '560001' });
    assert.equal(ProfileFacts.resolveProfileField(PROFILE, 'favourite colour'), null);
  });

  it('should compose a readable details block', function() {
    const block = ProfileFacts.composeProfileDetails(PROFILE);
    assert.ok(block.includes('Name: Rakesh Kumar'));
    assert.ok(block.includes('Email: rakesh@example.com'));
    assert.ok(block.includes('Job Title: Software Engineer'));
    assert.ok(block.includes('Country: India'));
    assert.ok(block.includes('Postal Code: 560001'));
  });

  it('should build a compact summary', function() {
    const summary = ProfileFacts.profileSummary(PROFILE);
    assert.ok(summary.includes('Rakesh Kumar'));
    assert.ok(summary.includes('Software Engineer at Acme Corp'));
    assert.ok(summary.includes('Bengaluru, India'));
  });
});

describe('Profile-based writing routing', function() {

  it('should write the user name from the profile', async function() {
    const router = routerWithProfile();
    const result = await router.process('write my name in notepad', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.equal(result.entities.text, 'Rakesh Kumar');
    assert.equal(result.entities.appName, 'notepad');
  });

  it('should write the user email into a target app', async function() {
    const router = routerWithProfile();
    const result = await router.process('write my email in notepad', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.equal(result.entities.text, 'rakesh@example.com');
    assert.equal(result.entities.appName, 'notepad');
  });

  it('should type the phone number without a target', async function() {
    const router = routerWithProfile();
    const result = await router.process('type my phone number', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.equal(result.entities.text, '+919876543210');
  });

  it('should sign the user name', async function() {
    const router = routerWithProfile();
    const result = await router.process('sign my name', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.equal(result.entities.text, 'Rakesh Kumar');
  });

  it('should write a single profile field into a file target', async function() {
    const router = routerWithProfile();
    const result = await router.process('put my job title in notes.txt', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.equal(result.entities.text, 'Software Engineer');
    assert.equal(result.entities.filename, 'notes.txt');
  });

  it('should write all details into the active window when asked', async function() {
    const router = routerWithProfile();
    const result = await router.process('fill my details', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.match(result.entities.text, /Name: Rakesh Kumar/);
    assert.match(result.entities.text, /Email: rakesh@example.com/);
    assert.match(result.entities.text, /Country: India/);
  });

  it('should write an explicitly named person as literal text', async function() {
    const router = routerWithProfile();
    const result = await router.process('write my name rakesh', 'chat');
    assert.equal(result.intent, 'text.write');
    assert.equal(result.entities.text, 'rakesh');
  });

  it('should not hijack media playback requests', async function() {
    const router = routerWithProfile();
    const result = await router.process('can you put on my favorite playlist', 'chat');
    assert.notEqual(result.intent, 'text.write');
  });

  it('should not hijack typo form-fill requests', async function() {
    const router = routerWithProfile();
    const result = await router.process('fill this from', 'chat');
    assert.equal(result.intent, 'form.fill');
    assert.equal(result.entities.userFacts.email, 'rakesh@example.com');
  });
});

describe('Profile facts into form fillers', function() {

  it('should autofill form fields from the saved profile', async function() {
    const forms = new FormAutomation({ assistant: { userProfile: PROFILE } });
    const result = forms.fillFormFromContext([
      { name: 'Full name', id: 'fullname', required: true },
      { name: 'Email Address', id: 'email', type: 'email', required: true },
      { name: 'Phone Number', id: 'phone' },
      { name: 'Occupation', id: 'occupation' },
      { name: 'Company', id: 'company' }
    ]);
    assert.equal(result.filledData.email, 'rakesh@example.com');
    assert.equal(result.filledData.phone, '+919876543210');
    assert.equal(result.filledData.occupation, 'Software Engineer');
    assert.equal(result.filledData.company, 'Acme Corp');
    assert.equal(result.completionPercentage, 100);
    assert.equal(result.userFactsUsed, 5);
  });

  it('should fill the lastName field via lastName variants', async function() {
    const forms = new FormAutomation({ assistant: { userProfile: PROFILE } });
    const result = forms.fillFormFromContext([
      { name: 'Last Name', id: 'last_name' },
      { name: 'First Name', id: 'first_name' }
    ]);
    assert.equal(result.filledData['First Name'], 'Rakesh');
    assert.equal(result.filledData['Last Name'], 'Kumar');
  });
});

describe('Expanded profile settings schema', function() {

  function createService() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-profile-settings-'));
    const config = {
      app: { name: 'OpenX', dataDir: tempDir },
      assistant: { displayName: 'OpenX' }
    };
    return { service: new SettingsService(config), tempDir };
  }

  it('should expose all profile fields and persist new ones', function() {
    const { service, tempDir } = createService();
    const saved = service.saveSettings({
      userProfile: {
        fullName: 'Rakesh Kumar',
        firstName: 'Rakesh',
        lastName: 'Kumar',
        email: 'rakesh@example.com',
        phone: '+91 98765 43210',
        jobTitle: 'Software Engineer',
        department: 'Engineering',
        company: 'Acme Corp',
        website: 'https://rakesh.dev',
        linkedin: 'linkedin.com/in/rakesh',
        github: 'github.com/rakesh',
        twitter: '@rakesh',
        username: 'rakesh_k',
        addressLine2: 'Apt 4B',
        dateOfBirth: '1990-05-15',
        gender: 'male',
        nationality: 'Indian'
      }
    });
    try {
      assert.equal(saved.userProfile.fullName, 'Rakesh Kumar');
      assert.equal(saved.userProfile.firstName, 'Rakesh');
      assert.equal(saved.userProfile.lastName, 'Kumar');
      assert.equal(saved.userProfile.jobTitle, 'Software Engineer');
      assert.equal(saved.userProfile.department, 'Engineering');
      assert.equal(saved.userProfile.addressLine2, 'Apt 4B');
      assert.equal(saved.userProfile.dateOfBirth, '1990-05-15');
      assert.equal(saved.userProfile.gender, 'male');
      assert.equal(saved.userProfile.nationality, 'Indian');
      assert.equal(saved.userProfile.phone, '+919876543210');
      assert.equal(saved.userProfile.website, 'https://rakesh.dev');
      assert.equal(saved.userProfile.github, 'github.com/rakesh');
      const runtime = service.buildRuntimeConfig();
      assert.equal(runtime.assistant.userProfile.jobTitle, 'Software Engineer');
      assert.equal(runtime.assistant.userProfile.linkedin, 'linkedin.com/in/rakesh');
      assert.equal(runtime.assistant.userProfile.country, '');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});