export interface BusinessResult {
  placeId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  userRatingsTotal: number;
  mapsUrl: string;
  location: {
    lat: number;
    lng: number;
  };
}

export interface SavedBusiness {
  id: string;
  userId: string;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  latitude: number | null;
  longitude: number | null;
  mapsUrl: string | null;
  industry: string | null;
  city: string | null;
  favorited: boolean;
  painPoint: string | null;
  outreachAngle: string | null;
  suggestedOffer: string | null;
  createdAt: string;
}

export interface LeadSystem {
  headline: string;
  subheadline: string;
  qualificationQuestions: string[];
  bookingCTA: string;
  followUpSequence: {
    day: number;
    channel: "email" | "sms";
    message: string;
  }[];
  offerPositioning: string;
  businessStrategy: string;
}

export interface ContentSystem {
  contentPillars: string[];
  thirtyDayPlan: {
    day: number;
    format: string;
    hook: string;
    caption: string;
    hashtags: string[];
  }[];
  shortFormHooks: string[];
  localAngles: string[];
}

export interface ProposalData {
  title: string;
  packageOverview: string;
  deliverables: string[];
  monthlyPrice: number;
  benefits: string[];
  nextSteps: string;
  emailMessage: string;
}

export interface BusinessSuggestions {
  painPoint: string;
  outreachAngle: string;
  suggestedOffer: string;
}

export interface FullProposal {
  id: string;
  userId: string;
  businessId: string;
  title: string;
  packageOverview: string;
  deliverables: string[];
  monthlyPrice: number;
  benefits: string[];
  nextSteps: string | null;
  emailMessage: string | null;
  publicId: string;
  status: string;
  systemsIncluded: string[];
  createdAt: string;
  updatedAt: string;
  business: SavedBusiness;
}

export interface Deal {
  id: string;
  userId: string;
  businessId: string;
  proposalId: string | null;
  stage: string;
  monthlyValue: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  business: SavedBusiness;
  proposal: FullProposal | null;
}
