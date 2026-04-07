'use client';

import { useState, useCallback } from 'react';
import { useChineseScript } from '@/lib/i18n/chinese-converter';
import { cn } from '@/lib/utils';

interface VisaCategory {
  code: string;
  name: string;
  match: 'high' | 'medium' | 'low';
  description: string;
  processingTime: string;
  employerRequired: boolean;
  requirements: string[];
  pros: string[];
  cons: string[];
}

interface ScreenerResult {
  categories: VisaCategory[];
  notes: string[];
  nextSteps: string;
  disclaimer: string;
}

interface FormData {
  goal: string;
  citizenship: string;
  birthCountry: string;
  currentLocation: string;
  currentStatus: string;
  occupation: string;
  yearsExperience: string;
  hasEmployerSponsor: string;
  salaryRange: string;
  hasUSCitizenFamily: boolean;
  hasLPRFamily: boolean;
  familyRelationship: string;
  highestDegree: string;
  fieldOfStudy: string;
  hasExtraordinaryAchievements: boolean;
}

const GOALS = [
  { value: 'Work in the US', icon: '🎯', en: 'Work in the US' },
  { value: 'Study in the US', icon: '🎓', en: 'Study in the US' },
  { value: 'Get a green card / permanent residency', icon: '🏠', en: 'Get green card' },
  { value: 'Family reunification', icon: '👨‍👩‍👧‍👦', en: 'Family reunification' },
  { value: 'Start a business / invest in the US', icon: '🏢', en: 'Start business / invest' },
  { value: 'Seek asylum / protection', icon: '🆘', en: 'Seek asylum / protection' },
];

const STATUSES = [
  'No visa (outside US)', 'B1/B2 Tourist Visa', 'F1 Student Visa', 'H1B Work Visa',
  'L1 Intracompany Transfer Visa', 'O1 Extraordinary Ability Visa', 'J1 Exchange Visitor Visa', 'E2 Investor Visa',
  'Already have green card (interested in naturalization)', 'Other visa', 'Overstay',
];

const DEGREES = ['High school or below', 'Associate degree', 'Bachelor\'s degree', 'Master\'s degree', 'Doctorate (PhD/MD/JD)', 'Other professional degree'];

const MATCH_STYLES = {
  high: { bg: 'border-green-300 bg-green-50', badge: 'bg-green-500 text-white', label: 'High Match' },
  medium: { bg: 'border-amber-300 bg-amber-50', badge: 'bg-amber-500 text-white', label: 'Possible Match' },
  low: { bg: 'border-blue-300 bg-blue-50', badge: 'bg-blue-500 text-white', label: 'Worth Exploring' },
};

const TOTAL_STEPS = 6;

export function ScreenerClient() {
  const { convert } = useChineseScript();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScreenerResult | null>(null);
  const [form, setForm] = useState<FormData>({
    goal: '', citizenship: '', birthCountry: '', currentLocation: 'In the US',
    currentStatus: '', occupation: '', yearsExperience: '', hasEmployerSponsor: '',
    salaryRange: '', hasUSCitizenFamily: false, hasLPRFamily: false, familyRelationship: '',
    highestDegree: '', fieldOfStudy: '', hasExtraordinaryAchievements: false,
  });

  const updateForm = (key: keyof FormData, value: string | boolean) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const canProceed = () => {
    switch (step) {
      case 1: return !!form.goal;
      case 2: return !!form.citizenship;
      case 3: return !!form.currentStatus;
      case 4: return true; // Optional fields
      case 5: return true;
      case 6: return true;
      default: return false;
    }
  };

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/immigration/visa-screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.status === 429) { setError('Too many requests, please try again later'); return; }
      if (!res.ok) { setError('Assessment failed, please try again later'); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('Network error, please check your connection');
    } finally {
      setLoading(false);
    }
  }, [form]);

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1);
    else handleSubmit();
  };

  const handleRestart = () => {
    setStep(1);
    setResult(null);
    setError('');
    setForm({
      goal: '', citizenship: '', birthCountry: '', currentLocation: 'In the US',
      currentStatus: '', occupation: '', yearsExperience: '', hasEmployerSponsor: '',
      salaryRange: '', hasUSCitizenFamily: false, hasLPRFamily: false, familyRelationship: '',
      highestDegree: '', fieldOfStudy: '', hasExtraordinaryAchievements: false,
    });
  };

  // ─── Loading State ───
  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">{convert('AI is analyzing your situation...')}</h3>
        <p className="text-sm text-gray-500">{convert('Based on your information, our AI assistant is evaluating visa categories that may fit you')}</p>
      </div>
    );
  }

  // Helper: build summary items from form data
  const getSummaryItems = () => {
    const items: { label: string; value: string }[] = [];
    if (form.goal) items.push({ label: 'Goal', value: form.goal });
    if (form.citizenship) items.push({ label: 'Citizenship', value: form.citizenship });
    if (form.birthCountry && form.birthCountry !== form.citizenship) items.push({ label: 'Birth Country', value: form.birthCountry });
    if (form.currentLocation) items.push({ label: 'Location', value: form.currentLocation });
    if (form.currentStatus) items.push({ label: 'Status', value: form.currentStatus });
    if (form.occupation) items.push({ label: 'Occupation', value: form.occupation });
    if (form.yearsExperience) items.push({ label: 'Experience', value: `${form.yearsExperience} years` });
    if (form.hasEmployerSponsor) items.push({ label: 'Employer Sponsor', value: form.hasEmployerSponsor });
    if (form.hasUSCitizenFamily) items.push({ label: 'US Citizen Relative', value: form.familyRelationship || 'Yes' });
    if (form.hasLPRFamily) items.push({ label: 'Green Card Relative', value: 'Yes' });
    if (form.highestDegree) items.push({ label: 'Education', value: form.highestDegree });
    if (form.fieldOfStudy) items.push({ label: 'Field of Study', value: form.fieldOfStudy });
    if (form.hasExtraordinaryAchievements) items.push({ label: 'Notable Achievements', value: 'Yes' });
    return items;
  };

  // ─── Results State ───
  if (result) {
    const summaryItems = getSummaryItems();
    return (
      <div>
        {/* User Info Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <div className="text-xs font-semibold text-gray-500 mb-2">{convert('Your Information:')}</div>
          <div className="flex flex-wrap gap-2">
            {summaryItems.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">
                <span className="text-gray-400">{convert(item.label)}:</span>
                <span className="text-gray-700 font-medium">{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Results Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">{convert('Your Visa Eligibility Assessment Results')}</h2>
          <p className="text-sm text-gray-500">{convert('Based on your personal situation, here are visa categories that may fit you')}</p>
        </div>

        {/* Category Cards */}
        <div className="space-y-4 mb-8">
          {result.categories.map((cat, i) => {
            const style = MATCH_STYLES[cat.match];
            return (
              <div key={i} className={cn('border-2 rounded-2xl p-5 sm:p-6', style.bg)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full', style.badge)}>{style.label}</span>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{cat.code} {cat.name}</h3>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">{cat.description}</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 mb-0.5">{convert('Processing Time')}</div>
                    <div className="text-xs font-semibold text-gray-900">{cat.processingTime}</div>
                  </div>
                  <div className="bg-white/60 rounded-lg p-3">
                    <div className="text-[10px] text-gray-500 mb-0.5">{convert('Employer Required')}</div>
                    <div className="text-xs font-semibold text-gray-900">{cat.employerRequired ? convert('Required') : convert('Not Required')}</div>
                  </div>
                  {cat.requirements?.[0] && (
                    <div className="bg-white/60 rounded-lg p-3">
                      <div className="text-[10px] text-gray-500 mb-0.5">{convert('Key Requirements')}</div>
                      <div className="text-xs font-semibold text-gray-900">{cat.requirements[0]}</div>
                    </div>
                  )}
                </div>

                {(cat.pros?.length > 0 || cat.cons?.length > 0) && (
                  <div className="grid sm:grid-cols-2 gap-3 text-xs">
                    {cat.pros?.length > 0 && (
                      <div>
                        {cat.pros.map((p, j) => (
                          <div key={j} className="flex items-start gap-1.5 mb-1">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span className="text-gray-700">{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {cat.cons?.length > 0 && (
                      <div>
                        {cat.cons.map((c, j) => (
                          <div key={j} className="flex items-start gap-1.5 mb-1">
                            <span className="text-amber-500 mt-0.5">⚠</span>
                            <span className="text-gray-700">{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Notes */}
        {result.notes?.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3">{convert('Important Notes')}</h3>
            <div className="space-y-2">
              {result.notes.map((note, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-amber-500 flex-shrink-0">⚠️</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
            {result.nextSteps && (
              <div className="flex items-start gap-2 text-sm text-gray-700 mt-2 pt-2 border-t border-gray-100">
                <span className="text-blue-500 flex-shrink-0">📋</span>
                <span>{result.nextSteps}</span>
              </div>
            )}
          </div>
        )}

        {/* Consultation CTA */}
        <div className="bg-gradient-to-br from-primary to-orange-600 rounded-2xl p-6 sm:p-8 text-center text-white mb-6">
          <h3 className="text-lg font-bold mb-2">{convert('Want to know which option is best for you?')}</h3>
          <p className="text-sm text-white/80 mb-5">{convert('Free consultation with an immigration attorney — 30-minute one-on-one assessment to help plan your best strategy')}</p>
          <button className="px-8 py-3 bg-white text-primary font-bold rounded-xl hover:bg-gray-50 transition">
            {convert('Book Free Consultation')}
          </button>
          <p className="text-xs text-white/60 mt-3">{convert('500+ people have found the right immigration attorney through Baam')}</p>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 mb-6">
          {result.disclaimer || convert('This assessment is for reference only and does not constitute legal advice. Specific eligibility should be determined by a licensed immigration attorney based on your detailed situation.')}
        </div>

        {/* Restart */}
        <div className="text-center">
          <button onClick={handleRestart} className="text-sm text-gray-500 hover:text-primary transition flex items-center gap-1 mx-auto">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            {convert('Start Over')}
          </button>
        </div>
      </div>
    );
  }

  // ─── Form Steps ───
  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm">{convert(error)}</div>
      )}

      {/* Previous Answers Summary (shown from step 2+) */}
      {step > 1 && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <div className="text-xs font-semibold text-gray-500 mb-2">{convert('Your Information:')}</div>
          <div className="flex flex-wrap gap-2">
            {getSummaryItems().map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 rounded-full px-2.5 py-1">
                <span className="text-gray-400">{convert(item.label)}:</span>
                <span className="text-gray-700 font-medium">{item.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
          <div key={s} className="flex items-center">
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition cursor-pointer',
              s < step ? 'bg-green-500 text-white hover:bg-green-600' :
              s === step ? 'bg-primary text-white' :
              'bg-gray-200 text-gray-400'
            )}
            onClick={() => { if (s < step) setStep(s); }}
            >
              {s < step ? '✓' : s}
            </div>
            {s < TOTAL_STEPS && (
              <div className={cn('w-8 h-0.5', s < step ? 'bg-green-500' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <div className="text-xs text-gray-400 mb-1">Step {step} / {TOTAL_STEPS}</div>

        {/* Step 1: Goal */}
        {step === 1 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{convert('What is your goal?')}</h2>
            <p className="text-sm text-gray-500 mb-4">{convert('Select the option that best matches your current needs')}</p>
            <div className="space-y-2">
              {GOALS.map((g) => (
                <button key={g.value} onClick={() => updateForm('goal', g.value)}
                  className={cn('w-full flex items-center gap-3 p-4 border-2 rounded-xl text-left transition',
                    form.goal === g.value ? 'border-primary bg-orange-50' : 'border-gray-200 hover:border-gray-300')}>
                  <span className="text-2xl">{g.icon}</span>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{convert(g.value)}</div>
                    <div className="text-xs text-gray-400">{g.en}</div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Nationality */}
        {step === 2 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{convert('Your Citizenship and Birth Country')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Citizenship')}</label>
                <input type="text" value={form.citizenship} onChange={(e) => updateForm('citizenship', e.target.value)}
                  className="w-full h-11 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Birth Country')}</label>
                <input type="text" value={form.birthCountry} onChange={(e) => updateForm('birthCountry', e.target.value)}
                  className="w-full h-11 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Current Location')}</label>
                <select value={form.currentLocation} onChange={(e) => updateForm('currentLocation', e.target.value)}
                  className="w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none">
                  <option value="In the US">{convert('In the US')}</option>
                  <option value="Outside US">{convert('Outside US')}</option>
                  <option value="Other Country">{convert('Other Country')}</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Current Status */}
        {step === 3 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{convert('Your Current Immigration Status')}</h2>
            <div className="space-y-2">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => updateForm('currentStatus', s)}
                  className={cn('w-full p-3 border-2 rounded-xl text-left text-sm transition',
                    form.currentStatus === s ? 'border-primary bg-orange-50 font-medium' : 'border-gray-200 hover:border-gray-300')}>
                  {convert(s)}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 4: Employment */}
        {step === 4 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{convert('Work and Career Information')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Occupation / Industry')}</label>
                <input type="text" value={form.occupation} onChange={(e) => updateForm('occupation', e.target.value)}
                  placeholder={convert('e.g., Software Engineer, Accountant, Chef')}
                  className="w-full h-11 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Work Experience (Years)')}</label>
                <select value={form.yearsExperience} onChange={(e) => updateForm('yearsExperience', e.target.value)}
                  className="w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{convert('Please select')}</option>
                  <option value="0-1">0-1 years</option><option value="2-5">2-5 years</option>
                  <option value="5-10">5-10 years</option><option value="10+">10+ years</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Is your employer willing to sponsor a visa / green card?')}</label>
                <select value={form.hasEmployerSponsor} onChange={(e) => updateForm('hasEmployerSponsor', e.target.value)}
                  className="w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{convert('Please select')}</option>
                  <option value="Yes">{convert('Yes, employer is willing')}</option>
                  <option value="No">{convert('No / Not sure')}</option>
                  <option value="Self-employed">{convert('I am self-employed / entrepreneur')}</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Step 5: Family */}
        {step === 5 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{convert('Family Ties')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{convert('Do you have immediate family who are US citizens?')}</label>
                <div className="flex gap-3">
                  <button onClick={() => updateForm('hasUSCitizenFamily', true)}
                    className={cn('flex-1 p-3 border-2 rounded-xl text-sm text-center transition',
                      form.hasUSCitizenFamily ? 'border-primary bg-orange-50' : 'border-gray-200')}>
                    {convert('Yes')}
                  </button>
                  <button onClick={() => updateForm('hasUSCitizenFamily', false)}
                    className={cn('flex-1 p-3 border-2 rounded-xl text-sm text-center transition',
                      !form.hasUSCitizenFamily ? 'border-primary bg-orange-50' : 'border-gray-200')}>
                    {convert('No')}
                  </button>
                </div>
              </div>
              {form.hasUSCitizenFamily && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Relationship')}</label>
                  <select value={form.familyRelationship} onChange={(e) => updateForm('familyRelationship', e.target.value)}
                    className="w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none">
                    <option value="">{convert('Please select')}</option>
                    <option value="Spouse">{convert('Spouse')}</option>
                    <option value="Parent">{convert('Parent')}</option>
                    <option value="Child (21+)">{convert('Child (over 21)')}</option>
                    <option value="Sibling">{convert('Sibling')}</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{convert('Do you have immediate family who are green card holders?')}</label>
                <div className="flex gap-3">
                  <button onClick={() => updateForm('hasLPRFamily', true)}
                    className={cn('flex-1 p-3 border-2 rounded-xl text-sm text-center transition',
                      form.hasLPRFamily ? 'border-primary bg-orange-50' : 'border-gray-200')}>
                    {convert('Yes')}
                  </button>
                  <button onClick={() => updateForm('hasLPRFamily', false)}
                    className={cn('flex-1 p-3 border-2 rounded-xl text-sm text-center transition',
                      !form.hasLPRFamily ? 'border-primary bg-orange-50' : 'border-gray-200')}>
                    {convert('No')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 6: Education */}
        {step === 6 && (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-4">{convert('Education Background')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Highest Degree')}</label>
                <select value={form.highestDegree} onChange={(e) => updateForm('highestDegree', e.target.value)}
                  className="w-full h-11 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary outline-none">
                  <option value="">{convert('Please select')}</option>
                  {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{convert('Field of Study')}</label>
                <input type="text" value={form.fieldOfStudy} onChange={(e) => updateForm('fieldOfStudy', e.target.value)}
                  placeholder={convert('e.g., Computer Science, Business Administration, Electrical Engineering')}
                  className="w-full h-11 px-4 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{convert('Do you have notable achievements in your field?')}</label>
                <p className="text-xs text-gray-400 mb-2">{convert('e.g., published papers, patents, industry awards, media coverage')}</p>
                <div className="flex gap-3">
                  <button onClick={() => updateForm('hasExtraordinaryAchievements', true)}
                    className={cn('flex-1 p-3 border-2 rounded-xl text-sm text-center transition',
                      form.hasExtraordinaryAchievements ? 'border-primary bg-orange-50' : 'border-gray-200')}>
                    {convert('Yes')}
                  </button>
                  <button onClick={() => updateForm('hasExtraordinaryAchievements', false)}
                    className={cn('flex-1 p-3 border-2 rounded-xl text-sm text-center transition',
                      !form.hasExtraordinaryAchievements ? 'border-primary bg-orange-50' : 'border-gray-200')}>
                    {convert('No')}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              {convert('Previous')}
            </button>
          ) : <div />}
          <button onClick={handleNext} disabled={!canProceed()}
            className="px-6 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2">
            {step === TOTAL_STEPS ? convert('Get Assessment Results') : convert('Next')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
