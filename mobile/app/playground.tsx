import React,{lazy,Suspense} from 'react';
import {Redirect} from 'expo-router';
import {Screen,Body} from '../src/components/Screen';
import {useLanguage} from '../src/i18n';
const Playground=lazy(()=>import('../src/SkiaGate'));
export default function Route(){const {t}=useLanguage();return __DEV__?<Suspense fallback={<Screen><Body>{t('loading')}</Body></Screen>}><Playground/></Suspense>:<Redirect href="/"/>}
