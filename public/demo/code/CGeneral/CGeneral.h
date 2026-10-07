#ifndef __GEO_COOL_H__
#define __GEO_COOL_H__

#include "Geo/PnGeometry3D.h"



class CGeneralBlockCreator : public FLM3Geo::BlockCreator3d
	{
	public:
		explicit CGeneralBlockCreator( const FLM3Geo::BlockCreator3d &a_rBlockCreator )
			: BlockCreator3d( a_rBlockCreator ) { };

		// Element creation functions
        short makeCHIL();
		short makeDC();	
		short makeRC();
		short makeRH();
		short makeBC();
		short makeFHS();
		short makeHBSB();
		short makePC();
		short makeTANK();
		short makePUMP();
		short makeAVT();
		short make2WayValve();
		short makeCFSMA();
		short makeDV();
		short make3WayValve();
		short makeMEF();
		short makeMF();
		short makeDE();
		short makeETV();
		short makeFCON();
		short makeMA();
		short makeSTV();
		short makeMA2();
		short makeSV();
		short makeFITA();
		short makeFPA();
		short makeFWP();
		short makePSITEA();
		short makeSWTA();
		short makeTFMN();
		short makeTFMT();
		short makeUNION();
		short makeWNIT();
		short makeWTIT();
		short makeCASS();

		// KK based on CIAT library
		short makeFCHC();
		short makeFCVC();

		// Male and Female
		short makePTHR();
		short makeFMRTHR();
		short makeETHR();
		short makeSTTHR();
		short makeCRTHR();
		short makeRTTHR();
		short makeYTHR();
		short makeCOTHR();
		short makeFMETHR();
		short makeFRTHR();
		short makeMFRTHR();
		short makeMRTHR();

		// Flanged
		short makeCRFLN();
		short makeEFLN();
		short makePFLN();
		short makeRFLN();
		short makeRTFLN();
		short makeSTFLN();

		// Welded
		short makeCOWLD();
		short makeCRWLD();
		short makeEWLD();
		short makePWLD();
		short makeRWLD();
		short makeRTWLD();
		short makeSTWLD();
		short makeTSWLD();

		short makeBUTTV();
		short makeSABEAM();
		short make3WSABEAM();


		// HDPE 100
		short makeHDPECP();
		short makeHDPERP();
		short makeTRPPFV();
		short makeTP90();
		short makeTRP90();
		short make51N();
		short makeKOL();

		// Sanipack
		short makeTRHT();
		short makeCZJE();
		short makeKP();
		short makeRED();
		short makeRW();
		short makeCZ();

		// PP Pipe system
		short makePIPP();
		short makeELBPP();
		short makeMFRPP();
		short makeTRPP();
		short makeTRREDPP();

		// PEX Pipe system
		short makeZLPEX();
		short makeZLREDPEX();
		short makeELBPEX();
		short makeTRPEX();
		short makeTRREDPEX();
		short makeZLGZPEX();
		short makeZLGWPEX();
		short makeELBGZPEX();
		short makeELBGWPEX();
		short makeTRGZPEX();
		short makeTRGWPEX();
		short makePIPPEX();

		// New element for Sanipack [TK]
		short makeSIPHON();

		// New elements for Hydronicpack
		short makeFANUTAC();  // clone of CIAT fancoil
		short makeAQ();       // cooling towers
		short makeMD_TS();
		short makeNC_18();
		short makeAV_18();
		short makeMW_07();
		short makeJC();

		// New element done by [OL]
		short makeTERMOPJ();

		// New elements for Sanipack [OO]
		short makeSAN_GRILL_1();
		short makeSAN_GRILL_2();
		short makeSAN_GRILL_3();
		short makeSAN_GRILL_4();
		short makeSAN_GRILL_5();
		short makeSAN_GRILL_6();
		short makeSAN_GRILL_7();
		short makeSAN_GRILL_8();
		short makeSAN_GRILL_9();
		short makeSAN_GRILL_10();
		short makeSAN_GRILL_11();
		short makeSAN_GRILL_12();
		short makeSAN_GRILL_13();
		short makeSAN_GRILL_14();
		short makeSAN_GRILL_15();
		short makeSAN_GRILL_16();
		short makeSAN_GRILL_17();
		short makeSAN_GRILL_18();
		short makeSAN_GRILL_19();

		// Basins for Sanipack by [OO]
		short makeWC_1();     // hanging toilet #1
		short makeWC_2();     // hanging toilet #2
		short makeWC_3();     // classic standing toilet
		short makeBidet1();   // wall hung bidet
		short makeWB_1();     // Bathroom wash basin
		short makeWB_2();     // Bathroom wash basin mounted in cabinet
		short makeWB_3();     // Bathroom wash basin mounted on cabinet
		short makeWB_4();     // Bathroom wash basin square
		short makeBTH_1();    // shower and bathtub
		short makeBTH_2();    // bathtub
		short makeK_SINK1();  // kitchen sink, single basin
		short makeK_SINK2();  // kitchen sink, single basin with drainboard
		short makeK_SINK3();  // kitchen sink, double basin
		short makeK_SINK4();  // kitchen sink, double basin with drainboard

			// Universal function to creation kitchen sinks with 1 or 2 bowls.
			void makeKitchenSink(int nComplexityV = 15, int nComplexityR = 10,
			                     double boardW1 = 50, double boardW2 = 50, double boardW3 = 200,
			                     double bowlW1 = 200, double bowlW2 = 300, double gap1 = 50, double gap2 = 50, double bowlL = 300,
			                     double bowlR1 = 30, double bowlR2 = 30, double topH = 3, double topR = 10, double bowlH = 100,
			                     double bowlThickness = 3);

		// Frames for Sanipack by [SL]
		short makeSanWallInstWC();
		short makeSanWallInstShowerDrain();
		short makeSanWallInstWashb();

			// additional functions for wall installations
			void makeSewPipe(const FdPoint3d &pIns, const FdVector3d &vN, double d, double l, int tubeComplexQuad);

			// Sewage / water out elbow, copied from 'CGeneralBlockCreator::makeKOL()'
			void makePipeElb(const FdPoint3d &cp, const FdVector3d &vN, const FdVector3d &vUp,
			                 double d, double h, double l, int tubeComplexQuad);

			void drawFrame(const FdPoint3d &pInsWall, const FdVector3d &vN, const FdVector3d &vUp,
			               double H, double B, double Hlegs, double Hfr,
			               double Bfr, double Tfr, double Twall_dist, bool Hangers = true);
			               // pInsWall - point on the floor / wall corner
			               // Twall_dist - distance from frame to wall
			               // Hlegs  - height of frame legs (within height H)
			               // Hfr, Tfr - height and thickness of frame profile

			void addShowerSet(const FdPoint3d &pIns, const FdVector3d &vN, const FdVector3d &vUp, double dConn,
			                  bool controlPlane, double h, double w, double Twall, int tubeComplexQuad);
			                  // pIns - central back point of water_mix box
			                  // h - defines distance from water_mix box and upper shower head
			                  // w - defines distance from water_mix box and hand shower hanger

		// Non-standard fittings for Sanipack by [SL]
		short makeCombCornerBranchRight87_5();
		short makeDuctBranchLeft87_5();
		short makeParalBranch45();
		short makeMovTRHT();
		short makeMovCZJE();

			// Helper to create PP-MD connectors on the Sanipack non-standard fittings
			void addConnectorPPMD(const FdPoint3d &pIns, const FdVector3d &vN, const FdVector3d &vUp,
			                      double arrDiam[5], double arrHeight[4], int nTubeComplex, bool drawInnerTube = true, bool detailed = false);

			// Horizontal stripes on the PP-MD connector tubes
			void makeConnHorStripes(const FdPoint3d &pTubeCentre, const FdVector3d &vNTube, double dTube,
			                        double hTube, const FdVector3d& vN, short nStripes, int nTubeComplex);

			// Cup-bowl joints for the movable connectors
			void makeBowlJoint(const FdPoint3d &pIns, const FdVector3d &vN, double dext,
			                   double dext2, double thickn, double h, int nTubeComplex);

		// KAN-THERM - GENERAL (Testing)
		short makeTrojnik();
		short makeTrojnik2();
		short makeTrojnik3();
		short makeTrojnik4();
		short makeZlaczka1();
		short makeZlaczka2();
		short makeZlaczka3();
		short makeLacznik1();
		short makeLacznik2();
		short makeLacznik3();
		short makeLacznik4();
		short makeKolano1();
		short makeKolano2();
		short makeKolano3();
		short makePolsrubunek();
		short makeSrubunek();
		short makeKolano4();
		short makeKolano5();
		short makeKolano6();
		short makeKorek();
		short makeTrojnik5();
		short makeZlaczka4();
		short makePodejscie1();
		short makePodejscie2();
		short makePodejscie3();
		short makePodejscie4();
		short makePodejscie5();
		short makePodejscie6();
		short makeMijanka1();
		short makeMijanka2();

		//additional new elements from ChungPD
		short makeB_MainHold();
		//short makePlateExchanger_V1();
		short makePlateExchanger_V2();
		short makeDishWash();
		short makeFWaterMeter();
		short makeWaterCirPump();
		short makeWaterMeter();
		short makeSewerAerVale();
		short makeAntiConVale();
		short makeReflexSL();
		short makeReflexDT();
		//short makeValveTASDp();
		short makeAntiCVEA453();
		short makeWashingMashineTop();
		short makeReflexG400();
		short makeWashingMashineFront();
		//short makeXT701();


	protected:

	double GetFlgSize(const char *linkId)
		{  double ret;  get_fln_size(linkId, ret);  return ret;  };
	double GetFlgThick(const char *linkId)
		{  double ret;  get_fln_thick(linkId, ret);  return ret;  };
	double GetFlgDiam(const char *linkId)
		{  double ret;  get_fln_diam(linkId, ret);  return ret;  };

	short makeVent(FdPoint3d pt, FdVector3d v, FdVector3d upv, ads_real rad, bool circle = true);
	short makeHSym(FdPoint3d pt, FdVector3d v, FdVector3d upv, ads_real rad, short typ);

	// New symbolic primitves by KW that are still missing from main API.
	void makeCircleWithPlusAndMinus(FdPoint3d c, FdVector3d v, FdVector3d upv, double diam);
	short makeCGrill(FdPoint3d c, FdVector3d v, FdVector3d upv, ads_real width, ads_real height);
	};

const char *const __GEO_NAME[] =
	{
	"CHIL",
	"DC",
	"RC",
	"RH",
	"BC",
	"FHS",
	"HBSB",
	"PC",
	"TANK",
	"PUMP",
	"AVT",
	"2WayValve",
	"CFSMA",
	"DV",
	"3WayValve",
	"MEF",
	"MF",
	"DE",
	"ETV",
	"FCON",
	"MA",
	"STV",
	"MA2",
	"SV",
	"FITA",
	"FPA",
	"FWP",
	"PSITEA",
	"SWTA",
	"TFMN",
	"TFMT",
	"UNION",
	"WNIT",
	"WTIT",
	"CASS",

	// KK based on CIAT library
	"FCHC",
	"FCVC",

	// THR
	"CpPTHR",
	"CpFMRTHR",
	"CpETHR",
	"CpSTTHR",
	"CpCRTHR",
	"CpRTTHR",
	"CpYTHR",
	"CpCOTHR",
	"CpFMETHR",
	"CpFRTHR",
	"CpMFRTHR",
	"CpMRTHR",

	// FLN
	"CpCRFLN",
	"CpEFLN",
	"CpPFLN",
	"CpRFLN",
	"CpRTFLN",
	"CpSTFLN",

	// WLD
	"CpCOWLD",
	"CpCRWLD",
	"CpEWLD",
	"CpPWLD",
	"CpRWLD",
	"CpRTWLD",
	"CpSTWLD",

	// OGLD
	"CpCOGLD",
	"CpCRGLD",
	"CpEGLD",
	"CpFMRGLD",
	"CpFRGLD",
	"CpPGLD",
	"CpRTGLD",
	"CpSTGLD",

	// SWLD
	"CpCOSWLD",
	"CpCRSWLD",
	"CpESWLD",
	"CpFMESWLD",
	"CpFMRSWLD",
	"CpFRSWLD",
	"CpPSWLD",
	"CpRTSWLD",
	"CpSTSWLD",
	"CpYSWLD",

	// BWLD
	"CpCOBWLD",
	"CpCRBWLD",
	"CpEBWLD",
	"CpPBWLD",
	"CpRBWLD",
	"CpTSBWLD",
	"CpRTBWLD",
	"CpSTBWLD",

	// COPPER
	"CpCOCOPPER",
	"CpCRCOPPER",
	"CpELCOPPER",
	"CpESCOPPER",
	"CpFMRCOPPER",
	"CpFRCOPPER",
	"CpPCOPPER",
	"CpRTCOPPER",
	"CpSTCOPPER",

	// New elements (OO)
	"BUTTV",
	"SABEAM",
	"3WSABEAM",

	// HDPE 100
	"HDPECP",
	"HDPERP",
	"TRPPFV",
	"TP90",
	"TRP90",
	"51N",
	"KOL",

	// Sanipack
	"TRHT",
	"CZJE",
	"KP",
	"RED",
	"RW",
	"CZ",

	// PP Pipe system
	"PIPP",
	"ELBPP",
	"MFRPP",
	"TRPP",
	"TRREDPP",

	// PEX Pipe system
	"ZLPEX",
	"ZLREDPEX",
	"ELBPEX",
	"TRPEX",
	"TRREDPEX",
	"ZLGZPEX",
	"ZLGWPEX",
	"ELBGZPEX",
	"ELBGWPEX",
	"TRGZPEX",
	"TRGWPEX",
	"PIPPEX",

	// New element for Sanipack [TK]
	"SIPHON",

	// New elements for Hydronicpack
	"FANUTAC",  // clone of CIAT fancoil
	"AQ",       // cooling towers
	"MD_TS",
	"NC_18",
	"AV_18",
	"MW_07",
	"JC",

	// New element done by [OL]
	"TERMOPJ",

	// New elements for Sanipack [OO]
	"SAN_GRILL_1",
	"SAN_GRILL_2",
	"SAN_GRILL_3",
	"SAN_GRILL_4",
	"SAN_GRILL_5",
	"SAN_GRILL_6",
	"SAN_GRILL_7",
	"SAN_GRILL_8",
	"SAN_GRILL_9",
	"SAN_GRILL_10",
	"SAN_GRILL_11",
	"SAN_GRILL_12",
	"SAN_GRILL_13",
	"SAN_GRILL_14",
	"SAN_GRILL_15",
	"SAN_GRILL_16",
	"SAN_GRILL_17",
	"SAN_GRILL_18",
	"SAN_GRILL_19",

	// Basins for Sanipack by [OO]
	"WC_1",
	"WC_2",
	"WC_3",
	"bidet_1",
	"WB_1",
	"WB_2",
	"WB_3",
	"WB_4",
	"BTH_1",
	"BTH_2",
	"K_SINK1",
	"K_SINK2",
	"K_SINK3",
	"K_SINK4",

	// Frames for Sanipack by [SL]
	"SanWallInstWC",
	"SanWallInstShowerDrain",
	"SanWallInstWashb",

	// Non-standard fittings for Sanipack by [SL]
	"CombCornerBranchRight87_5",
	"DuctBranchLeft87_5",
	"ParalBranch45",
	"MovTRHT",
	"MovCZJE",

	// KAN-THERM - GENERAL (Testing)
	"Trojnik",
	"Trojnik2",
	"Trojnik3",
	"Trojnik4",
	"Zlaczka1",
	"Zlaczka2",
	"Zlaczka3",
	"Lacznik1",
	"Lacznik2",
	"Lacznik3",
	"Lacznik4",
	"Kolano1",
	"Kolano2",
	"Kolano3",
	"Polsrubunek",
	"Srubunek",
	"Kolano4",
	"Kolano5",
	"Kolano6",
	"Korek",
	"Trojnik5",
	"Zlaczka4",
	"Podejscie1",
	"Podejscie2",
	"Podejscie3",
	"Podejscie4",
	"Podejscie5",
	"Podejscie6",
	"Mijanka1",
	"Mijanka2",
	"B_MainHold",
	//"PlateExchanger_V1",
	"PlateExchanger",
	"DishWash",
	"FWaterMeter",
	"WaterCirPump",
	"WaterMeter",
	"SewerAerVale",
	"AntiConVale",
	"ReflexSL",
	"ReflexDT",
	//"ValveTASDp",
	"AntiCVEA453",
	"WashingMashineTop",
	"ReflexG400",
	"WashingMashineFront"
	};

typedef short (CGeneralBlockCreator::*const geometry_fn) ();
const geometry_fn __GEO_FN [] =
	{
	&CGeneralBlockCreator::makeCHIL,
	&CGeneralBlockCreator::makeDC,
	&CGeneralBlockCreator::makeRC,
	&CGeneralBlockCreator::makeRH,
	&CGeneralBlockCreator::makeBC,
	&CGeneralBlockCreator::makeFHS,
	&CGeneralBlockCreator::makeHBSB,
	&CGeneralBlockCreator::makePC,
	&CGeneralBlockCreator::makeTANK,
	&CGeneralBlockCreator::makePUMP,
	&CGeneralBlockCreator::makeAVT,
	&CGeneralBlockCreator::make2WayValve,
	&CGeneralBlockCreator::makeCFSMA,
	&CGeneralBlockCreator::makeDV,
	&CGeneralBlockCreator::make3WayValve,
	&CGeneralBlockCreator::makeMEF,
	&CGeneralBlockCreator::makeMF,
	&CGeneralBlockCreator::makeDE,
	&CGeneralBlockCreator::makeETV,
	&CGeneralBlockCreator::makeFCON,
	&CGeneralBlockCreator::makeMA,
	&CGeneralBlockCreator::makeSTV,
	&CGeneralBlockCreator::makeMA2,
	&CGeneralBlockCreator::makeSV,
	&CGeneralBlockCreator::makeFITA,
	&CGeneralBlockCreator::makeFPA,
	&CGeneralBlockCreator::makeFWP,
	&CGeneralBlockCreator::makePSITEA,
	&CGeneralBlockCreator::makeSWTA,
	&CGeneralBlockCreator::makeTFMN,
	&CGeneralBlockCreator::makeTFMT,
	&CGeneralBlockCreator::makeUNION,
	&CGeneralBlockCreator::makeWNIT,
	&CGeneralBlockCreator::makeWTIT,
	&CGeneralBlockCreator::makeCASS,

// KK based on CIAT library
	&CGeneralBlockCreator::makeFCHC,
	&CGeneralBlockCreator::makeFCVC,

// THR
	&CGeneralBlockCreator::makePTHR,
	&CGeneralBlockCreator::makeFMRTHR,
	&CGeneralBlockCreator::makeETHR,
	&CGeneralBlockCreator::makeSTTHR,
	&CGeneralBlockCreator::makeCRTHR,
	&CGeneralBlockCreator::makeRTTHR,
	&CGeneralBlockCreator::makeYTHR,
	&CGeneralBlockCreator::makeCOTHR,
	&CGeneralBlockCreator::makeFMETHR,
	&CGeneralBlockCreator::makeFRTHR,
	&CGeneralBlockCreator::makeMFRTHR,
	&CGeneralBlockCreator::makeMRTHR,

// FLN
	&CGeneralBlockCreator::makeCRFLN,
	&CGeneralBlockCreator::makeEFLN,
	&CGeneralBlockCreator::makePFLN,
	&CGeneralBlockCreator::makeRFLN,
	&CGeneralBlockCreator::makeRTFLN,
	&CGeneralBlockCreator::makeSTFLN,

// WLD
	&CGeneralBlockCreator::makeCOWLD,
	&CGeneralBlockCreator::makeCRWLD,
	&CGeneralBlockCreator::makeEWLD,
	&CGeneralBlockCreator::makePWLD,
	&CGeneralBlockCreator::makeRWLD,
	&CGeneralBlockCreator::makeRTWLD,
	&CGeneralBlockCreator::makeSTWLD,

// OGLD
	&CGeneralBlockCreator::makeCOTHR,
	&CGeneralBlockCreator::makeCRTHR,
	&CGeneralBlockCreator::makeETHR,
	&CGeneralBlockCreator::makeFMRTHR,
	&CGeneralBlockCreator::makeFRTHR,
	&CGeneralBlockCreator::makePTHR,
	&CGeneralBlockCreator::makeRTTHR,
	&CGeneralBlockCreator::makeSTTHR,

// SWLD
	&CGeneralBlockCreator::makeCOTHR,
	&CGeneralBlockCreator::makeCRTHR,
	&CGeneralBlockCreator::makeETHR,
	&CGeneralBlockCreator::makeFMETHR,
	&CGeneralBlockCreator::makeFMRTHR,
	&CGeneralBlockCreator::makeFRTHR,
	&CGeneralBlockCreator::makePTHR,
	&CGeneralBlockCreator::makeRTTHR,
	&CGeneralBlockCreator::makeSTTHR,
	&CGeneralBlockCreator::makeYTHR,

// BWLD
	&CGeneralBlockCreator::makeCOWLD,
	&CGeneralBlockCreator::makeCRWLD,
	&CGeneralBlockCreator::makeEWLD,
	&CGeneralBlockCreator::makePWLD,
	&CGeneralBlockCreator::makeRWLD,
	&CGeneralBlockCreator::makeTSWLD,
	&CGeneralBlockCreator::makeRTWLD,
	&CGeneralBlockCreator::makeSTWLD,

// COPPER
	&CGeneralBlockCreator::makeCOTHR,
	&CGeneralBlockCreator::makeCRTHR,
	&CGeneralBlockCreator::makeETHR,
	&CGeneralBlockCreator::makeETHR,
	&CGeneralBlockCreator::makeFMRTHR,
	&CGeneralBlockCreator::makeFRTHR,
	&CGeneralBlockCreator::makePTHR,
	&CGeneralBlockCreator::makeRTTHR,
	&CGeneralBlockCreator::makeSTTHR,

	&CGeneralBlockCreator::makeBUTTV,
	&CGeneralBlockCreator::makeSABEAM,
	&CGeneralBlockCreator::make3WSABEAM,

// HDPE 100
	&CGeneralBlockCreator::makeHDPECP,
	&CGeneralBlockCreator::makeHDPERP,
	&CGeneralBlockCreator::makeTRPPFV,
	&CGeneralBlockCreator::makeTP90,
	&CGeneralBlockCreator::makeTRP90,
	&CGeneralBlockCreator::make51N,
	&CGeneralBlockCreator::makeKOL,

// Sanipack
	&CGeneralBlockCreator::makeTRHT,
	&CGeneralBlockCreator::makeCZJE,
	&CGeneralBlockCreator::makeKP,
	&CGeneralBlockCreator::makeRED,
	&CGeneralBlockCreator::makeRW,
	&CGeneralBlockCreator::makeCZ,

// PP Pipe system
	&CGeneralBlockCreator::makePIPP,
	&CGeneralBlockCreator::makeELBPP,
	&CGeneralBlockCreator::makeMFRPP,
	&CGeneralBlockCreator::makeTRPP,
	&CGeneralBlockCreator::makeTRREDPP,

// PEX Pipe system
	&CGeneralBlockCreator::makeZLPEX,
	&CGeneralBlockCreator::makeZLREDPEX,
	&CGeneralBlockCreator::makeELBPEX,
	&CGeneralBlockCreator::makeTRPEX,
	&CGeneralBlockCreator::makeTRREDPEX,
	&CGeneralBlockCreator::makeZLGZPEX,
	&CGeneralBlockCreator::makeZLGWPEX,
	&CGeneralBlockCreator::makeELBGZPEX,
	&CGeneralBlockCreator::makeELBGWPEX,
	&CGeneralBlockCreator::makeTRGZPEX,
	&CGeneralBlockCreator::makeTRGWPEX,
	&CGeneralBlockCreator::makePIPPEX,

// New element for Sanipack [TK]
	&CGeneralBlockCreator::makeSIPHON,

// New elements for Hydronicpack
	&CGeneralBlockCreator::makeFANUTAC,  // clone of CIAT fancoil
	&CGeneralBlockCreator::makeAQ,       // cooling towers
	&CGeneralBlockCreator::makeMD_TS,
	&CGeneralBlockCreator::makeNC_18,
	&CGeneralBlockCreator::makeAV_18,
	&CGeneralBlockCreator::makeMW_07,
	&CGeneralBlockCreator::makeJC,

// New element done by [OL]
	&CGeneralBlockCreator::makeTERMOPJ,

// New elements for Sanipack [OO]
	&CGeneralBlockCreator::makeSAN_GRILL_1,
	&CGeneralBlockCreator::makeSAN_GRILL_2,
	&CGeneralBlockCreator::makeSAN_GRILL_3,
	&CGeneralBlockCreator::makeSAN_GRILL_4,
	&CGeneralBlockCreator::makeSAN_GRILL_5,
	&CGeneralBlockCreator::makeSAN_GRILL_6,
	&CGeneralBlockCreator::makeSAN_GRILL_7,
	&CGeneralBlockCreator::makeSAN_GRILL_8,
	&CGeneralBlockCreator::makeSAN_GRILL_9,
	&CGeneralBlockCreator::makeSAN_GRILL_10,
	&CGeneralBlockCreator::makeSAN_GRILL_11,
	&CGeneralBlockCreator::makeSAN_GRILL_12,
	&CGeneralBlockCreator::makeSAN_GRILL_13,
	&CGeneralBlockCreator::makeSAN_GRILL_14,
	&CGeneralBlockCreator::makeSAN_GRILL_15,
	&CGeneralBlockCreator::makeSAN_GRILL_16,
	&CGeneralBlockCreator::makeSAN_GRILL_17,
	&CGeneralBlockCreator::makeSAN_GRILL_18,
	&CGeneralBlockCreator::makeSAN_GRILL_19,

// Basins for Sanipack [OL]
	&CGeneralBlockCreator::makeWC_1,
	&CGeneralBlockCreator::makeWC_2,
	&CGeneralBlockCreator::makeWC_3,
	&CGeneralBlockCreator::makeBidet1,
	&CGeneralBlockCreator::makeWB_1,
	&CGeneralBlockCreator::makeWB_2,
	&CGeneralBlockCreator::makeWB_3,
	&CGeneralBlockCreator::makeWB_4,
	&CGeneralBlockCreator::makeBTH_1,
	&CGeneralBlockCreator::makeBTH_2,
	&CGeneralBlockCreator::makeK_SINK1,
	&CGeneralBlockCreator::makeK_SINK2,
	&CGeneralBlockCreator::makeK_SINK3,
	&CGeneralBlockCreator::makeK_SINK4,

// Frames for Sanipack by [SL]
	&CGeneralBlockCreator::makeSanWallInstWC,
	&CGeneralBlockCreator::makeSanWallInstShowerDrain,
	&CGeneralBlockCreator::makeSanWallInstWashb,

// Non-standard fittings for Sanipack by [SL]
	&CGeneralBlockCreator::makeCombCornerBranchRight87_5,
	&CGeneralBlockCreator::makeDuctBranchLeft87_5,
	&CGeneralBlockCreator::makeParalBranch45,
	&CGeneralBlockCreator::makeMovTRHT,
	&CGeneralBlockCreator::makeMovCZJE,

// KAN-THERM - GENERAL (Testing)
	&CGeneralBlockCreator::makeTrojnik,
	&CGeneralBlockCreator::makeTrojnik2,
	&CGeneralBlockCreator::makeTrojnik3,
	&CGeneralBlockCreator::makeTrojnik4,
	&CGeneralBlockCreator::makeZlaczka1,
	&CGeneralBlockCreator::makeZlaczka2,
	&CGeneralBlockCreator::makeZlaczka3,
	&CGeneralBlockCreator::makeLacznik1,
	&CGeneralBlockCreator::makeLacznik2,
	&CGeneralBlockCreator::makeLacznik3,
	&CGeneralBlockCreator::makeLacznik4,
	&CGeneralBlockCreator::makeKolano1,
	&CGeneralBlockCreator::makeKolano2,
	&CGeneralBlockCreator::makeKolano3,
	&CGeneralBlockCreator::makePolsrubunek,
	&CGeneralBlockCreator::makeSrubunek,
	&CGeneralBlockCreator::makeKolano4,
	&CGeneralBlockCreator::makeKolano5,
	&CGeneralBlockCreator::makeKolano6,
	&CGeneralBlockCreator::makeKorek,
	&CGeneralBlockCreator::makeTrojnik5,
	&CGeneralBlockCreator::makeZlaczka4,
	&CGeneralBlockCreator::makePodejscie1,
	&CGeneralBlockCreator::makePodejscie2,
	&CGeneralBlockCreator::makePodejscie3,
	&CGeneralBlockCreator::makePodejscie4,
	&CGeneralBlockCreator::makePodejscie5,
	&CGeneralBlockCreator::makePodejscie6,
	&CGeneralBlockCreator::makeMijanka1,
	&CGeneralBlockCreator::makeMijanka2,

	//additional new elements ChungPD
	&CGeneralBlockCreator::makeB_MainHold,
	//&CGeneralBlockCreator::makePlateExchanger_V1,
	&CGeneralBlockCreator::makePlateExchanger_V2,
	&CGeneralBlockCreator::makeDishWash,
	&CGeneralBlockCreator::makeFWaterMeter,
	&CGeneralBlockCreator::makeWaterCirPump,
	&CGeneralBlockCreator::makeWaterMeter,
	&CGeneralBlockCreator::makeSewerAerVale,
	&CGeneralBlockCreator::makeAntiConVale,
	&CGeneralBlockCreator::makeReflexSL,
	&CGeneralBlockCreator::makeReflexDT,
	//&CGeneralBlockCreator::makeValveTASDp,
	&CGeneralBlockCreator::makeAntiCVEA453,
	&CGeneralBlockCreator::makeWashingMashineTop,
	&CGeneralBlockCreator::makeReflexG400,
	&CGeneralBlockCreator::makeWashingMashineFront,
	};

const int __COUNT_FN = sizeof(__GEO_NAME) / sizeof(*__GEO_NAME);

inline void setpt(ads_point p, ads_real x, ads_real y, ads_real z, int kx)
	{	setpt(p, kx * x, y, z);	};

inline void setpt(ads_point p, ads_real x, ads_real y, ads_real z, int kx,int ky)
	{	setpt(p, kx * x, ky * y, z);	};

#endif
