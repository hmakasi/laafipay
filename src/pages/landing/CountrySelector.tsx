import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRY_CODES, COUNTRY_META, PRICING_CURRENCY_LABEL } from '@/lib/constants';
import { useLandingCountryStore } from '@/store/landingCountryStore';
import { CountryCode } from '@/types';

// Sélecteur de pays du Navbar : pilote la devise/les tarifs affichés en
// Pricing et le mock-up du Hero (même store, voir landingCountryStore.ts).
export function CountrySelector() {
  const country = useLandingCountryStore((s) => s.country);
  const setCountry = useLandingCountryStore((s) => s.setCountry);

  return (
    <Select value={country} onValueChange={(value) => setCountry(value as CountryCode)}>
      <SelectTrigger
        aria-label="Choisir votre pays"
        className="h-9 w-auto gap-1.5 border-none bg-transparent px-2 text-sm font-medium shadow-none hover:bg-accent focus:ring-0 focus:ring-offset-0"
      >
        <span aria-hidden="true">{COUNTRY_META[country].flag}</span>
        {/* Enfant explicite requis : sans lui, Radix reflète tout le contenu du
           SelectItem sélectionné (drapeau + nom + devise) dans le trigger,
           ce qui doublerait le drapeau et surchargerait un menu de navbar. */}
        <SelectValue>{country}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {COUNTRY_CODES.map((code) => (
          <SelectItem key={code} value={code}>
            <span className="mr-1.5">{COUNTRY_META[code].flag}</span>
            {COUNTRY_META[code].name}
            <span className="ml-1.5 text-xs text-muted-foreground">({PRICING_CURRENCY_LABEL[code]})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
