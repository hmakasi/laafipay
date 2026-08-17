import { create } from 'zustand';
import { CountryCode } from '@/types';

// Pays "démo" sélectionné sur la landing page — pilote le sélecteur du
// Navbar, la section Pricing et le mock-up du Hero (DashboardCarousel).
// Un seul store partagé plutôt qu'un useState par section : sans ça, le
// visiteur pourrait choisir la RDC dans le header et voir des prix RDC
// alors que le mock-up du Hero resterait affiché pour le Burkina Faso.
interface LandingCountryState {
  country: CountryCode;
  setCountry: (country: CountryCode) => void;
}

export const useLandingCountryStore = create<LandingCountryState>((set) => ({
  country: 'BF',
  setCountry: (country) => set({ country }),
}));
