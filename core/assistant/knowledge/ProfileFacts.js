'use strict';

const PROFILE_FIELDS = [
  { key: 'fullName', label: 'Name', aliases: ['full name', 'fullname', 'name', 'my name'] },
  { key: 'firstName', label: 'First Name', aliases: ['first name', 'given name', 'forename'] },
  { key: 'middleName', label: 'Middle Name', aliases: ['middle name', 'middle initial'] },
  { key: 'lastName', label: 'Last Name', aliases: ['last name', 'surname', 'family name'] },
  { key: 'dateOfBirth', label: 'Date of Birth', aliases: ['date of birth', 'birth date', 'birthday', 'dob'] },
  { key: 'gender', label: 'Gender', aliases: ['gender', 'sex'] },
  { key: 'nationality', label: 'Nationality', aliases: ['nationality', 'citizenship'] },
  { key: 'email', label: 'Email', aliases: ['email', 'e-mail', 'mail', 'email address', 'e mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'phone number', 'mobile', 'mobile number', 'cell', 'cell number', 'contact number', 'telephone', 'telephone number'] },
  { key: 'username', label: 'Username', aliases: ['username', 'user name', 'login', 'user id', 'handle'] },
  { key: 'website', label: 'Website', aliases: ['website', 'web site', 'site', 'url', 'web address'] },
  { key: 'linkedin', label: 'LinkedIn', aliases: ['linkedin', 'linked in'] },
  { key: 'github', label: 'GitHub', aliases: ['github', 'git hub'] },
  { key: 'twitter', label: 'Twitter', aliases: ['twitter', 'twitter handle'] },
  { key: 'company', label: 'Company', aliases: ['company', 'organization', 'organisation', 'employer', 'workplace', 'work place', 'company name'] },
  { key: 'jobTitle', label: 'Job Title', aliases: ['job title', 'title', 'position', 'designation', 'profession', 'occupation'] },
  { key: 'department', label: 'Department', aliases: ['department', 'team'] },
  { key: 'role', label: 'Role', aliases: ['role'] },
  { key: 'addressLine1', label: 'Address', aliases: ['address', 'street address', 'street', 'address line 1', 'address line one'] },
  { key: 'addressLine2', label: 'Address Line 2', aliases: ['address line 2', 'address line two', 'apartment', 'suite', 'unit'] },
  { key: 'city', label: 'City', aliases: ['city', 'town'] },
  { key: 'state', label: 'State', aliases: ['state', 'province', 'region'] },
  { key: 'postalCode', label: 'Postal Code', aliases: ['postal code', 'zip code', 'zip', 'pin code', 'postcode'] },
  { key: 'country', label: 'Country', aliases: ['country', 'nation'] }
];

const PROFILE_DISPLAY_ORDER = [
  'fullName',
  'firstName',
  'middleName',
  'lastName',
  'dateOfBirth',
  'gender',
  'nationality',
  'email',
  'phone',
  'username',
  'website',
  'linkedin',
  'github',
  'twitter',
  'company',
  'jobTitle',
  'department',
  'role',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'country'
];

const SAVE_FIELDS = PROFILE_FIELDS.map(field => field.key);

function fieldByKey(key) {
  return PROFILE_FIELDS.find(field => field.key === key) || null;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function profileFromConfig(config = {}) {
  return (config && typeof config === 'object'
    ? config.assistant?.userProfile || config.userProfile || config.profile || {}
    : {}) || {};
}

function computeAge(dateOfBirth) {
  const raw = String(dateOfBirth || '').trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - parsed.getFullYear();
  const monthDiff = now.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function buildStreetAddress(profile = {}) {
  const first = String(profile.addressLine1 || '').trim();
  const second = String(profile.addressLine2 || '').trim();
  return [first, second].filter(Boolean).join(', ');
}

function profileToFacts(profile = {}) {
  const facts = {};
  for (const field of PROFILE_FIELDS) {
    const value = String(profile[field.key] || '').trim();
    if (value) {
      facts[field.key] = value;
    }
  }

  const fullName = String(profile.fullName || '').trim();
  if (fullName && !facts.name) {
    facts.name = fullName;
    facts.full_name = fullName;
  }

  const email = String(profile.email || '').trim();
  if (email) {
    facts.emailAddress = email;
    facts.gmail = email;
    facts.mail = email;
    facts['e-mail'] = email;
  }

  const phone = String(profile.phone || '').trim();
  if (phone) {
    facts.phoneNumber = phone;
    facts.mobile = phone;
    facts.mobileNumber = phone;
    facts.contact = phone;
  }

  const profession = String(profile.jobTitle || profile.role || '').trim();
  if (profession) {
    facts.profession = profession;
    facts.occupation = profession;
    facts.job = profession;
  }

  const workplace = String(profile.company || '').trim();
  if (workplace) {
    facts.workplace = workplace;
    facts.organization = workplace;
    facts.organisation = workplace;
    facts.employer = workplace;
  }

  const address = buildStreetAddress(profile);
  if (address) {
    facts.location = address;
    facts.address = address;
    facts.streetAddress = address;
  }

  const city = String(profile.city || '').trim();
  if (city && !facts.city) {
    facts.town = city;
  }
  if (city && !facts.location) {
    facts.location = city;
  }

  const state = String(profile.state || '').trim();
  if (state) {
    facts.province = state;
    facts.region = state;
  }

  const postalCode = String(profile.postalCode || '').trim();
  if (postalCode) {
    facts.zip = postalCode;
    facts.zipCode = postalCode;
    facts.zipcode = postalCode;
    facts.pinCode = postalCode;
    facts.postcode = postalCode;
  }

  const country = String(profile.country || '').trim();
  if (country) {
    facts.nation = country;
  }

  const age = computeAge(profile.dateOfBirth);
  if (age !== null) {
    facts.age = String(age);
  }

  return facts;
}

function resolveProfileField(profile = {}, rawInput = '') {
  const text = normalizeText(rawInput)
    .replace(/^(?:please\s+)?(?:my|the|your|a|an|own)\s+/i, '')
    .replace(/\s+(?:please|now)$/i, '')
    .trim();
  if (!text) return null;

  const matches = PROFILE_FIELDS
    .filter(field => field.aliases.includes(text))
    .sort((a, b) => b.aliases[0].length - a.aliases[0].length);

  for (const field of matches) {
    const value = String(profile[field.key] || '').trim();
    if (value) {
      return { key: field.key, label: field.label, value };
    }
  }

  return null;
}

function composeProfileDetails(profile = {}) {
  const lines = [];
  for (const key of PROFILE_DISPLAY_ORDER) {
    const field = fieldByKey(key);
    const value = String(profile[key] || '').trim();
    if (value && field) {
      lines.push(`${field.label}: ${value}`);
    }
  }
  return lines.join('\n');
}

function profileSummary(profile = {}) {
  const sections = [];
  const name = String(profile.fullName || '').trim();
  const title = [String(profile.jobTitle || '').trim(), String(profile.company || '').trim()]
    .filter(Boolean)
    .join(' at ');
  if (name) sections.push(name);
  if (title) sections.push(title);
  const location = [String(profile.city || '').trim(), String(profile.country || '').trim()]
    .filter(Boolean)
    .join(', ');
  if (location) sections.push(location);
  if (!sections.length) return '';
  return sections.join(' - ');
}

module.exports = {
  PROFILE_FIELDS,
  PROFILE_DISPLAY_ORDER,
  SAVE_FIELDS,
  fieldByKey,
  normalizeText,
  profileFromConfig,
  computeAge,
  profileToFacts,
  resolveProfileField,
  composeProfileDetails,
  profileSummary,
  buildStreetAddress
};