#include "StdAfx.h"
#include "GeoGeneral3D.h"


#define MAX_FN_NUM          221
#define GEN_RECT_FIRST      0
#define GEN_CIRC_FIRST      GEN_RECT_FIRST + 25
#define GEN_ACCS_FIRST      GEN_CIRC_FIRST + 23
#define GEN_FSEC_FIRST      GEN_ACCS_FIRST + 37
#define GEN_DIFF_FIRST      GEN_FSEC_FIRST + 9
#define GEN_OUTD_FIRST      GEN_DIFF_FIRST + 20
#define GEN_KARPOL_FIRST    GEN_OUTD_FIRST + 18
#define GEN_CHWENT_FIRST    GEN_KARPOL_FIRST + 21
#define GEN_ALNOR_FIRST     GEN_CHWENT_FIRST + 11
#define GEN_SZYMOR_FIRST    GEN_ALNOR_FIRST + 10
#define GEN_LINDAB_FIRST    GEN_SZYMOR_FIRST + 1

const char *FN_NAME[MAX_FN_NUM] =
	{
	// General library - Rectangular
	"GenBA",   "GenBO",   "GenCR5",   "GenEA",
	"GenHS",   "GenK",    "GenRA",    "GenRS",
	"GenTA",   "GenTG",   "GenTR1",   "GenTR2",
	"GenTR3",  "GenTR4",  "GenTR6",   "GenTR7",
	"GenTR8",  "GenUA",   "GenUS",    "GenWA",
	"GenCR1",  "GenCR2",  "GenTR1a",  "GenTR2a",
	"GenTR9",

	// General library - Circular
	"GenAP1",    "GenARE",     "GenAYE",       "GenBGE",
	"GenCP1",    "GenDFA",     "GenHSE",       "GenKXE",
	"GenMFA",    "GenOC1",     "GenSTE",       "GenTC1",
	"GenTC2",    "GenTC3",     "GenTUBE",      "GenUAE",
	"GenUSE",    "GenASV",     "GenCOLL",      "GenXSVL",
	"GenBPBKC",  "GenILSV45",  "GenTRI45_90",

	// General library - Accessories
	"GenRS1",   "GenCS1",                                      // Silencers
	"GenRD1",   "GenRD2",   "GenCD1",                          // Dampers
	"GenRF1",   "GenCF1",                                      // Filters
	"GenRH1",   "GenRH2",   "GenRH3",   "GenCH1",   "GenCH2",  // Heaters / Coolers
	"GenRV1",   "GenCV1",   "GenCV2",   "GenCV3",              // Ventilators
	"GenCRAF",  "GenRRAF",  "GenRRD1",  "GenCRD1",             // Roof ducts / cowls

	// New elements
	"GenCFC", "GenRFC", "GenIRIS",

	// duct holes
	"GenRCC", "GenCCC",

	// regulators
	"GenRVAV", "GenCCAV", "GenRCAV", "GenCVAV",

	// cooling heating regulation module
	"GenRHU", "GenCOWD", "GenROWD",

	// SB regulator
	"GenSB",

	// New one
	"GenSUC", "GenOKP", "GenRDO1", "GenGLE",

	// General library - Fire Security
	"GenCFD1",  "GenDCSD",  "GenDRSD",
	"GenDWSD",  "GenFV1",   "GenOWSD",
	"GenRFD1",  "GenSSD",   "GenTSD",

	// General library - Diffusion (Grilles and Boxes with grilles)
	"GenGrBCD1",  "GenGrBLD1",   "GenGrBRD1",
	"GenGrBRG1",  "GenGrBSCD1",  "GenGrBSRD1",
	"GenGrCG1",   "GenGrLD1",    "GenGrPPD1",   "GenGrRG1",

	"GenGrCD1",    "GenGrJD1",   "GenGrRD1",
	"GenGrSCD1",   "GenGrSRD1",  "GenGrVV1",
	"GenGrNKSWA",  "GenGrKHA",   "GenGrKPP",
	"GenGrNIM",

	// New outdoor grilles
	"GenRRC1",  "GenCRC1",  "GenWG",    "GenRRCB",
	"GenCRCD",  "GenCRCE",  "GenCRCG",  "GenCWG",
	"GenCRWG",

	"GenGrCDD",  "GenGrRDD",
	"GenRES",    "GenRRS",

	"GenKSO",   "GenUSMS",
	"GenTAGF",  "GenWDQE",
	"GenUSLA",

	// Karpol elements
	"KarKWO",   "KarWDPE",   "KarWDOE",    "KarWDPB",
	"KarCDPB",  "KarWDPA",   "KarWC",      "KarCP",
	"KarCDPA",  "KarPDOBI",  "KarPDOBII",  "KarWDOC",
	"KarCDOC",  "KarPDPAI",  "KarPDPAII",  "KarKWP",
	"KarCDPK",  "KarSK",     "KarARE45",   "KarRRD",  "KarKST",

	// Chemowent elements
	"HSE45",  "HSE90",  "DEFL",     "WP",     "MUFF450",
	"PMESH",  "CPRS",   "PRSTR45",  "STE45",  "OKRRP",
	"PDB",

	// Alnor elements
	"FLXPRO",    "FLXPROL",  "FLXPROPL",  "FLXPROP",  "FLXPRV14",
	"FLXPRV11",  "FLXVNS",   "FLXVBH",    "FLXVBW",   "FLXVODS",

	// SZYMOR elements
	"SZYM_SLP",

	// LINDAB elements
	"LIN_PKA",   "LIN_LKA",   "LIN_PCA",   "LIN_LCA",   "LIN_CRL",   "LIN_PC6",
	"LIN_RC14",  "LIN_RC15",  "LIN_NC19",  "LIN_RCG",   "LIN_LCC",   "LIN_LKP",
	"LIN_LCP",   "LIN_PS1",   "LIN_RS14",  "LIN_NS19",  "LIN_RS15",  "LIN_RS16",
	"LIN_RCWB",  "LIN_RCW",   "LIN_VS5",   "LIN_DCS",   "LIN_LCF",   "LIN_LCS",
	"LIN_LAD",   "LIN_PCS",   "LIN_AC",    "LIN_F50",   "LIN_WLS",   "LIN_CCU",
	"LIN_CRP",   "LIN_CRU",   "LIN_CBA",   "LIN_CHA",   "LIN_CQA",   "LIN_CCA",
	"LIN_CRA",   "LIN_CVA",   "LIN_CEA",   "LIN_CKA",   "LIN_CBAL",  "LIN_CBAV",
	"LIN_DR24",  "LIN_AIRY",  "LIN_KI",    "LIN_KU"
	};

FLM3Geo::ErrorStatus MakeFCBlock3d(FLM3Geo::BlockCreator3d *blockCreator, const char *blockName)
	{
	SmkGenBlockCreator blkCreator(*blockCreator);

	short res = -1;
	int cnt, code = -1;
	for( cnt = 0; cnt < MAX_FN_NUM; cnt++ )
		if( !strcmp(blockName, FN_NAME[cnt]) )
			{  code = cnt;  break;  };
	if( code < 0 )
		return FLM3Geo::eInvalid;

	switch( code )
		{
		// General - Rectangular
		case GEN_RECT_FIRST +  0:		res = blkCreator.makeGenBA();		break;
		case GEN_RECT_FIRST +  1:		res = blkCreator.makeGenBO();		break;
		case GEN_RECT_FIRST +  2:		res = blkCreator.makeGenCR5();		break;
		case GEN_RECT_FIRST +  3:		res = blkCreator.makeGenEA();		break;
		case GEN_RECT_FIRST +  4:		res = blkCreator.makeGenHS();		break;
		case GEN_RECT_FIRST +  5:		res = blkCreator.makeGenK();		break;
		case GEN_RECT_FIRST +  6:		res = blkCreator.makeGenRA();		break;
		case GEN_RECT_FIRST +  7:		res = blkCreator.makeGenRS();		break;
		case GEN_RECT_FIRST +  8:		res = blkCreator.makeGenTA();		break;
		case GEN_RECT_FIRST +  9:		res = blkCreator.makeGenTG();		break;
		case GEN_RECT_FIRST + 10:		res = blkCreator.makeGenTR1();		break;
		case GEN_RECT_FIRST + 11:		res = blkCreator.makeGenTR2();		break;
		case GEN_RECT_FIRST + 12:		res = blkCreator.makeGenTR3();		break;
		case GEN_RECT_FIRST + 13:		res = blkCreator.makeGenTR4();		break;
		case GEN_RECT_FIRST + 14:		res = blkCreator.makeGenTR6();		break;
		case GEN_RECT_FIRST + 15:		res = blkCreator.makeGenTR7();		break;
		case GEN_RECT_FIRST + 16:		res = blkCreator.makeGenTR8();		break;
		case GEN_RECT_FIRST + 17:		res = blkCreator.makeGenUA();		break;
		case GEN_RECT_FIRST + 18:		res = blkCreator.makeGenUS();		break;
		case GEN_RECT_FIRST + 19:		res = blkCreator.makeGenWA();		break;
		case GEN_RECT_FIRST + 20:		res = blkCreator.makeGenCR1();		break;
		case GEN_RECT_FIRST + 21:		res = blkCreator.makeGenCR2();		break;
		case GEN_RECT_FIRST + 22:		res = blkCreator.makeGenTR1a();		break;
		case GEN_RECT_FIRST + 23:		res = blkCreator.makeGenTR2a();		break;
		case GEN_RECT_FIRST + 24:		res = blkCreator.makeGenTR9();		break;

		// General - Circular
		case GEN_CIRC_FIRST +  0:		res = blkCreator.makeGenAP1();		break;
		case GEN_CIRC_FIRST +  1:		res = blkCreator.makeGenARE();		break;
		case GEN_CIRC_FIRST +  2:		res = blkCreator.makeGenAYE();		break;
		case GEN_CIRC_FIRST +  3:		res = blkCreator.makeGenBGE();		break;
		case GEN_CIRC_FIRST +  4:		res = blkCreator.makeGenCP1();		break;
		case GEN_CIRC_FIRST +  5:		res = blkCreator.makeGenDFA();		break;
		case GEN_CIRC_FIRST +  6:		res = blkCreator.makeGenHSE();		break;
		case GEN_CIRC_FIRST +  7:		res = blkCreator.makeGenKXE();		break;
		case GEN_CIRC_FIRST +  8:		res = blkCreator.makeGenMFA();		break;
		case GEN_CIRC_FIRST +  9:		res = blkCreator.makeGenOC1();		break;
		case GEN_CIRC_FIRST + 10:		res = blkCreator.makeGenSTE();		break;
		case GEN_CIRC_FIRST + 11:		res = blkCreator.makeGenTC1();		break;
		case GEN_CIRC_FIRST + 12:		res = blkCreator.makeGenTC2();		break;
		case GEN_CIRC_FIRST + 13:		res = blkCreator.makeGenTC3();		break;
		case GEN_CIRC_FIRST + 14:		res = blkCreator.makeGenTUBE();		break;
		case GEN_CIRC_FIRST + 15:		res = blkCreator.makeGenUAE();		break;
		case GEN_CIRC_FIRST + 16:		res = blkCreator.makeGenUSE();		break;
		case GEN_CIRC_FIRST + 17:		res = blkCreator.makeGenASV();		break;
		case GEN_CIRC_FIRST + 18:		res = blkCreator.makeGenCOLL();		break;
		case GEN_CIRC_FIRST + 19:		res = blkCreator.makeGenXSVL();		break;
		case GEN_CIRC_FIRST + 20:		res = blkCreator.makeGenBPBKC();	break;
		case GEN_CIRC_FIRST + 21:		res = blkCreator.makeGenILSV45();	break;
		case GEN_CIRC_FIRST + 22:		res = blkCreator.makeGenTRI45_90();	break;

		// General - Accesories
		case GEN_ACCS_FIRST +  0:		res = blkCreator.makeGenRS1();		break;
		case GEN_ACCS_FIRST +  1:		res = blkCreator.makeGenCS1();		break;
		case GEN_ACCS_FIRST +  2:		res = blkCreator.makeGenRD1();		break;
		case GEN_ACCS_FIRST +  3:		res = blkCreator.makeGenRD2();		break;
		case GEN_ACCS_FIRST +  4:		res = blkCreator.makeGenCD1();		break;
		case GEN_ACCS_FIRST +  5:		res = blkCreator.makeGenRF1();		break;
		case GEN_ACCS_FIRST +  6:		res = blkCreator.makeGenCF1();		break;
		case GEN_ACCS_FIRST +  7:		res = blkCreator.makeGenRH1();		break;
		case GEN_ACCS_FIRST +  8:		res = blkCreator.makeGenRH2();		break;
		case GEN_ACCS_FIRST +  9:		res = blkCreator.makeGenRH3();		break;
		case GEN_ACCS_FIRST + 10:		res = blkCreator.makeGenCH1();		break;
		case GEN_ACCS_FIRST + 11:		res = blkCreator.makeGenCH2();		break;
		case GEN_ACCS_FIRST + 12:		res = blkCreator.makeGenRV1();		break;
		case GEN_ACCS_FIRST + 13:		res = blkCreator.makeGenCV1();		break;
		case GEN_ACCS_FIRST + 14:		res = blkCreator.makeGenCV2();		break;
		case GEN_ACCS_FIRST + 15:		res = blkCreator.makeGenCV3();		break;
		case GEN_ACCS_FIRST + 16:		res = blkCreator.makeGenCRAF();		break;
		case GEN_ACCS_FIRST + 17:		res = blkCreator.makeGenRRAF();		break;
		case GEN_ACCS_FIRST + 18:		res = blkCreator.makeGenRRD1();		break;
		case GEN_ACCS_FIRST + 19:		res = blkCreator.makeGenCRD1();		break;

		case GEN_ACCS_FIRST + 20:		res = blkCreator.makeGenCFC();		break;
		case GEN_ACCS_FIRST + 21:		res = blkCreator.makeGenRFC();		break;
		case GEN_ACCS_FIRST + 22:		res = blkCreator.makeGenIRIS();		break;

		case GEN_ACCS_FIRST + 23:		res = blkCreator.makeGenRCC();		break;
		case GEN_ACCS_FIRST + 24:		res = blkCreator.makeGenCCC();		break;

		case GEN_ACCS_FIRST + 25:		res = blkCreator.makeGenRVAV();		break;
		case GEN_ACCS_FIRST + 26:		res = blkCreator.makeGenCCAV();		break;
		case GEN_ACCS_FIRST + 27:		res = blkCreator.makeGenRCAV();		break;
		case GEN_ACCS_FIRST + 28:		res = blkCreator.makeGenCVAV();		break;
		case GEN_ACCS_FIRST + 29:		res = blkCreator.makeGenRHU();		break;
		case GEN_ACCS_FIRST + 30:		res = blkCreator.makeGenCOWD();		break;
		case GEN_ACCS_FIRST + 31:		res = blkCreator.makeGenROWD();		break;
		case GEN_ACCS_FIRST + 32:		res = blkCreator.makeGenSB();		break;

		case GEN_ACCS_FIRST + 33:		res = blkCreator.makeGenSUC();		break;
		case GEN_ACCS_FIRST + 34:		res = blkCreator.makeGenOKP();		break;
		case GEN_ACCS_FIRST + 35:		res = blkCreator.makeGenRDO1();		break;
		case GEN_ACCS_FIRST + 36:		res = blkCreator.makeGenGLE();		break;

		// General - Fire Security
		case GEN_FSEC_FIRST +  0:	res = blkCreator.makeGenCFD1();			break;
		case GEN_FSEC_FIRST +  1:	res = blkCreator.makeGenDCSD();			break;
		case GEN_FSEC_FIRST +  2:	res = blkCreator.makeGenDRSD();			break;
		case GEN_FSEC_FIRST +  3:	res = blkCreator.makeGenDWSD();			break;
		case GEN_FSEC_FIRST +  4:	res = blkCreator.makeGenFV1();			break;
		case GEN_FSEC_FIRST +  5:	res = blkCreator.makeGenOWSD();			break;
		case GEN_FSEC_FIRST +  6:	res = blkCreator.makeGenRFD1();			break;
		case GEN_FSEC_FIRST +  7:	res = blkCreator.makeGenSSD();			break;
		case GEN_FSEC_FIRST +  8:	res = blkCreator.makeGenTSD();			break;

		// General - Diffusion
		case GEN_DIFF_FIRST +  0:	res = blkCreator.makeGenGrBCD1();		break;
		case GEN_DIFF_FIRST +  1:	res = blkCreator.makeGenGrBLD1();		break;
		case GEN_DIFF_FIRST +  2:	res = blkCreator.makeGenGrBRD1();		break;
		case GEN_DIFF_FIRST +  3:	res = blkCreator.makeGenGrBRG1();		break;
		case GEN_DIFF_FIRST +  4:	res = blkCreator.makeGenGrBSCD1();		break;
		case GEN_DIFF_FIRST +  5:	res = blkCreator.makeGenGrBSRD1();		break;

		case GEN_DIFF_FIRST +  6:	res = blkCreator.makeGenGrCG1();		break;
		case GEN_DIFF_FIRST +  7:	res = blkCreator.makeGenGrLD1();		break;
		case GEN_DIFF_FIRST +  8:	res = blkCreator.makeGenGrPPD1();		break;
		case GEN_DIFF_FIRST +  9:	res = blkCreator.makeGenGrRG1();		break;

		case GEN_DIFF_FIRST + 10:	res = blkCreator.makeGenGrCD1();		break;
		case GEN_DIFF_FIRST + 11:	res = blkCreator.makeGenGrJD1();		break;
		case GEN_DIFF_FIRST + 12:	res = blkCreator.makeGenGrRD1();		break;
		case GEN_DIFF_FIRST + 13:	res = blkCreator.makeGenGrSCD1();		break;
		case GEN_DIFF_FIRST + 14:	res = blkCreator.makeGenGrSRD1();		break;
		case GEN_DIFF_FIRST + 15:	res = blkCreator.makeGenGrVV1();		break;
		case GEN_DIFF_FIRST + 16:	res = blkCreator.makeGenGrNKSWA();		break;
		case GEN_DIFF_FIRST + 17:	res = blkCreator.makeGenGrKHA();		break;
		case GEN_DIFF_FIRST + 18:	res = blkCreator.makeGenGrKPP();		break;
		case GEN_DIFF_FIRST + 19:	res = blkCreator.makeGenGrNIM();		break;

		// General - Outdoor Grilles
		case GEN_OUTD_FIRST +  0:	res = blkCreator.makeGenRRC1();			break;
		case GEN_OUTD_FIRST +  1:	res = blkCreator.makeGenCRC1();			break;
		case GEN_OUTD_FIRST +  2:	res = blkCreator.makeGenWG();			break;
		case GEN_OUTD_FIRST +  3:	res = blkCreator.makeGenRRCB();			break;
		case GEN_OUTD_FIRST +  4:	res = blkCreator.makeGenCRCD();			break;
		case GEN_OUTD_FIRST +  5:	res = blkCreator.makeGenCRCE();			break;
		case GEN_OUTD_FIRST +  6:	res = blkCreator.makeGenCRCG();			break;
		case GEN_OUTD_FIRST +  7:	res = blkCreator.makeGenCWG();			break;

		case GEN_OUTD_FIRST +  8:	res = blkCreator.makeGenCRWG();			break;
		case GEN_OUTD_FIRST +  9:	res = blkCreator.makeGenCDD();			break;
		case GEN_OUTD_FIRST + 10:	res = blkCreator.makeGenRDD();			break;
		case GEN_OUTD_FIRST + 11:	res = blkCreator.makeGenRES();			break;
		case GEN_OUTD_FIRST + 12:	res = blkCreator.makeGenRRS();			break;

		case GEN_OUTD_FIRST + 13:	res = blkCreator.makeGenKSO();			break;
		case GEN_OUTD_FIRST + 14:	res = blkCreator.makeGenUSMS();			break;
		case GEN_OUTD_FIRST + 15:	res = blkCreator.makeGenTAGF();			break;
		case GEN_OUTD_FIRST + 16:	res = blkCreator.makeGenWDQE();			break;
		case GEN_OUTD_FIRST + 17:	res = blkCreator.makeGenUSLA();			break;

		// KARPOL
		case GEN_KARPOL_FIRST +  0:	res = blkCreator.makeKarKWO();			break;
		case GEN_KARPOL_FIRST +  1:	res = blkCreator.makeKarWDPE();			break;
		case GEN_KARPOL_FIRST +  2:	res = blkCreator.makeKarWDOE();			break;
		case GEN_KARPOL_FIRST +  3:	res = blkCreator.makeKarWDPB();			break;
		case GEN_KARPOL_FIRST +  4:	res = blkCreator.makeKarCDPB();			break;
		case GEN_KARPOL_FIRST +  5:	res = blkCreator.makeKarRRC1();			break;
		case GEN_KARPOL_FIRST +  6:	res = blkCreator.makeKarWC();			break;
		case GEN_KARPOL_FIRST +  7:	res = blkCreator.makeKarCP();			break;
		case GEN_KARPOL_FIRST +  8:	res = blkCreator.makeKarCDPA();			break;
		case GEN_KARPOL_FIRST +  9:	res = blkCreator.makeKarPDOBI();		break;
		case GEN_KARPOL_FIRST + 10:	res = blkCreator.makeKarPDOBII();		break;
		case GEN_KARPOL_FIRST + 11:	res = blkCreator.makeKarWDOC();			break;
		case GEN_KARPOL_FIRST + 12:	res = blkCreator.makeKarCDOC();			break;
		case GEN_KARPOL_FIRST + 13:	res = blkCreator.makeKarPDPAI();		break;
		case GEN_KARPOL_FIRST + 14:	res = blkCreator.makeKarPDPAII();		break;
		case GEN_KARPOL_FIRST + 15:	res = blkCreator.makeKarKWP();			break;
		case GEN_KARPOL_FIRST + 16:	res = blkCreator.makeKarCDPK();			break;
		case GEN_KARPOL_FIRST + 17:	res = blkCreator.makeKarSK();			break;
		case GEN_KARPOL_FIRST + 18:	res = blkCreator.makeKarARE45();		break;
		case GEN_KARPOL_FIRST + 19:	res = blkCreator.makeKarRRD();			break;
		case GEN_KARPOL_FIRST + 20:	res = blkCreator.makeKarKST();			break;

		// Chemowent
		case GEN_CHWENT_FIRST +  0:	res = blkCreator.makeGKI_TEE45();		break;
		case GEN_CHWENT_FIRST +  1:	res = blkCreator.makeGKI_TEE90();		break;
		case GEN_CHWENT_FIRST +  2:	res = blkCreator.makeGKI_DEFLEKTOR();	break;
		case GEN_CHWENT_FIRST +  3:	res = blkCreator.makeGKI_WALLPASS();	break;
		case GEN_CHWENT_FIRST +  4:	res = blkCreator.makeGKI_FLANGE();		break;
		case GEN_CHWENT_FIRST +  5:	res = blkCreator.makeGKI_PRMESH();		break;
		case GEN_CHWENT_FIRST +  6:	res = blkCreator.makeGKI_CPRS();		break;
		case GEN_CHWENT_FIRST +  7:	res = blkCreator.makeGKI_PRSTR45();		break;
		case GEN_CHWENT_FIRST +  8:	res = blkCreator.makeGKI_STE45();		break;
		case GEN_CHWENT_FIRST +  9:	res = blkCreator.makeGKI_OKRRP();		break;
		case GEN_CHWENT_FIRST + 10:	res = blkCreator.makeGKI_PDB();			break;

		// Alnor
		case GEN_ALNOR_FIRST +  0:	res = blkCreator.makeFLX_PRO();			break;
		case GEN_ALNOR_FIRST +  1:	res = blkCreator.makeFLX_PRO();			break;  // makeFLX_PRO_L()
		case GEN_ALNOR_FIRST +  2:	res = blkCreator.makeFLX_PRO_PL();		break;
		case GEN_ALNOR_FIRST +  3:	res = blkCreator.makeFLX_PRO_P();		break;
		case GEN_ALNOR_FIRST +  4:	res = blkCreator.makeFLX_PRV_14();		break;
		case GEN_ALNOR_FIRST +  5:	res = blkCreator.makeFLX_PRV_11();		break;
		case GEN_ALNOR_FIRST +  6:	res = blkCreator.makeFLX_VNS();			break;
		case GEN_ALNOR_FIRST +  7:	res = blkCreator.makeFLX_VBH();			break;
		case GEN_ALNOR_FIRST +  8:	res = blkCreator.makeFLX_VBW();			break;
		case GEN_ALNOR_FIRST +  9:	res = blkCreator.makeFLX_VODS();		break;

		// SZYMOR
		case GEN_SZYMOR_FIRST + 0:	res = blkCreator.makeSZYM_SLP();		break;

		// LINDAB
		case GEN_LINDAB_FIRST + 0:	res = blkCreator.makeLIN_PKA(); 		break;
		case GEN_LINDAB_FIRST + 1:	res = blkCreator.makeLIN_LKA(); 		break;
		case GEN_LINDAB_FIRST + 2:	res = blkCreator.makeLIN_PCA(); 		break;
		case GEN_LINDAB_FIRST + 3:	res = blkCreator.makeLIN_LCA(); 		break;
		case GEN_LINDAB_FIRST + 4:	res = blkCreator.makeLIN_CRL(); 		break;
		case GEN_LINDAB_FIRST + 5:	res = blkCreator.makeLIN_PC6(); 		break;
		case GEN_LINDAB_FIRST + 6:	res = blkCreator.makeLIN_RC14(); 		break;
		case GEN_LINDAB_FIRST + 7:	res = blkCreator.makeLIN_RC15(); 		break;
		case GEN_LINDAB_FIRST + 8:	res = blkCreator.makeLIN_NC19(); 		break;
		case GEN_LINDAB_FIRST + 9:	res = blkCreator.makeLIN_RCG(); 		break;
		case GEN_LINDAB_FIRST + 10:	res = blkCreator.makeLIN_LCC(); 		break;
		case GEN_LINDAB_FIRST + 11:	res = blkCreator.makeLIN_LKP(); 		break;
		case GEN_LINDAB_FIRST + 12:	res = blkCreator.makeLIN_LCP(); 		break;
		case GEN_LINDAB_FIRST + 13:	res = blkCreator.makeLIN_PS1(); 		break;
		case GEN_LINDAB_FIRST + 14:	res = blkCreator.makeLIN_RS14(); 		break;		
		case GEN_LINDAB_FIRST + 15:	res = blkCreator.makeLIN_NS19(); 		break;
		case GEN_LINDAB_FIRST + 16:	res = blkCreator.makeLIN_RS15(); 		break;
		case GEN_LINDAB_FIRST + 17:	res = blkCreator.makeLIN_RS16(); 		break;	
		case GEN_LINDAB_FIRST + 18:	res = blkCreator.makeLIN_RCWB(); 		break;
		case GEN_LINDAB_FIRST + 19:	res = blkCreator.makeLIN_RCW(); 		break;
		case GEN_LINDAB_FIRST + 20:	res = blkCreator.makeLIN_VS5(); 		break;	
		case GEN_LINDAB_FIRST + 21:	res = blkCreator.makeLIN_DCS(); 		break;
		case GEN_LINDAB_FIRST + 22:	res = blkCreator.makeLIN_LCF(); 		break;
		case GEN_LINDAB_FIRST + 23:	res = blkCreator.makeLIN_LCS(); 		break;
		case GEN_LINDAB_FIRST + 24:	res = blkCreator.makeLIN_LAD(); 		break;
		case GEN_LINDAB_FIRST + 25:	res = blkCreator.makeLIN_PCS(); 		break;
		case GEN_LINDAB_FIRST + 26:	res = blkCreator.makeLIN_AC(); 			break;
		case GEN_LINDAB_FIRST + 27:	res = blkCreator.makeLIN_F50(); 		break;
		case GEN_LINDAB_FIRST + 28:	res = blkCreator.makeLIN_WLS(); 		break;
		case GEN_LINDAB_FIRST + 29:	res = blkCreator.makeLIN_CCU(); 		break;
		case GEN_LINDAB_FIRST + 30:	res = blkCreator.makeLIN_CRP(); 		break;
		case GEN_LINDAB_FIRST + 31:	res = blkCreator.makeLIN_CRU(); 		break;
		case GEN_LINDAB_FIRST + 32:	res = blkCreator.makeLIN_CBA(); 		break;
		case GEN_LINDAB_FIRST + 33:	res = blkCreator.makeLIN_CHA(); 		break;
		case GEN_LINDAB_FIRST + 34:	res = blkCreator.makeLIN_CQA(); 		break;
		case GEN_LINDAB_FIRST + 35:	res = blkCreator.makeLIN_CCA(); 		break;
		case GEN_LINDAB_FIRST + 36:	res = blkCreator.makeLIN_CRA(); 		break;
		case GEN_LINDAB_FIRST + 37:	res = blkCreator.makeLIN_CVA(); 		break;
		case GEN_LINDAB_FIRST + 38:	res = blkCreator.makeLIN_CEA(); 		break;
		case GEN_LINDAB_FIRST + 39:	res = blkCreator.makeLIN_CKA(); 		break;
		case GEN_LINDAB_FIRST + 40:	res = blkCreator.makeLIN_CBAL(); 		break;
		case GEN_LINDAB_FIRST + 41:	res = blkCreator.makeLIN_CBAV(); 		break;
		case GEN_LINDAB_FIRST + 42:	res = blkCreator.makeLIN_DR24(); 		break;
		case GEN_LINDAB_FIRST + 43:	res = blkCreator.makeLIN_AIRY(); 		break;
		case GEN_LINDAB_FIRST + 44:	res = blkCreator.makeLIN_KI();	 		break;
		case GEN_LINDAB_FIRST + 45:	res = blkCreator.makeLIN_KU(); 			break;
		};

	return res ? FLM3Geo::eInvalid : FLM3Geo::eOK;
	};

#define SEGNUM(X) 16

ads_real fo = 30;		// Flange offset : el
ads_real fs = 45;		// Flange offset : eh
ads_real vfh = 30;		// Circular library

short SmkGenBlockCreator :: makeGenRS1()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRS1(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCS1()
	{
	ads_real d, l, l2;
	get_val("d", d);
	get_val("l", l);
	get_val("l2", l2);

#ifdef __TODO__AUX
	get_val("d2", d2);
#endif

	double dd = d + 100;
	makeCS1(d, dd, l, l2, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRD1()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRD1(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCD1()
	{
	ads_real d, l;
	get_val("d", d);
	get_val("l", l);

	double thick = min(32, 0.05 * d);
	double offset = min(64, 0.1 * d);
	double panel = min(160, d / 2.0);
	makeCD1(l, d, SEGNUM(d), l / 2.0, thick, SEGNUM(d),
	        panel, 2 * thick, 45, offset, 1.2 * panel,
	        d + 1.2 * offset, 8, SEGNUM(8), 12345);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRF1()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRF1(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCF1()
	{
	ads_real d, l, l2;
	get_val("d", d);
	get_val("l", l);
	get_val("l2", l2);

	makeCF1(d, l, l2, d + 100, SEGNUM(n));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRH1()
	{
	ads_real a, b, l;
	ads_real s1cp, s2cp;

	// shown variables
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	// hidden variables
	get_val ("s1cp", s1cp);
	get_val ("s2cp", s2cp);

	makeRH1(a, b, l, s1cp, s2cp, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRH2()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRH2(a, b, l, flange_1, flange_2);
	return 0;
	};





// Created by PK
short SmkGenBlockCreator :: makeGenRH3()
	{
	ads_real a, b, l;
	ads_real l1, l2, h, a1;
	ads_real s1cp, s2cp, s3cp;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	// hidden variables
	get_val ("l1", l1);
	get_val ("l2", l2);
	get_val ("h", h);
	get_val ("a1", a1);
	get_val ("s1cp", s1cp);
	get_val ("s2cp", s2cp);
	get_val ("s3cp", s3cp);

	makeRH3(a, b, l, l1, l2, h, a1, s1cp, s2cp, s3cp, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRD2()
	{
	ads_real a, b, l;
	ads_real sa, sb, sl, sd, a_aux;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("l", l);

	// hidden variables
	get_val ("sa", sa);
	get_val ("sb", sb);
	get_val ("sl", sl);
	get_val ("sd", sd);
	get_val ("a_aux", a_aux);

	makeRD2(a, b, l, sa, sb, sl, sd, a_aux);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRCC()
	{
	ads_real d0, a, b;
	ads_real h, h1, h2, l, f, c, d, a0, b0;

	// shown variables
	get_val ("D",d0);
	get_val ("a", a);
	get_val ("b", b);

	// hidden variables
	get_val ("h", h);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("l", l);
	get_val ("f", f);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("A", a0);
	get_val ("B", b0);

	makeRCC(d0, a, b, h, h1, h2, l, f, c, d, a0, b0, SEGNUM(d0));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCCC()
	{
	ads_real d0, a, b;
	ads_real h, h1, h2, l, f, c, d, a0, b0;

	// shown variables
	get_val ("D",d0);
	get_val ("a", a);
	get_val ("b", b);

	// hidden variables
	get_val ("h", h);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("l", l);
	get_val ("f", f);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("A", a0);
	get_val ("B", b0);

	makeCCC(d0, a, b, h, h1, h2, l, f, c, d, a0, b0, SEGNUM(d0));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRVAV()
	{
	ads_real a, b, l;
	ads_real l1, l2, h, h1, h2, h3;

	// shown variables
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);

	// hidden variables
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("h", h);
	get_val("h1", h1);
	get_val("h2", h2);
	get_val("h3", h3);

	makeRVAV(a, b, l, l1, l2, h, h1, h2, h3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCCAV()
	{
	ads_real d, l;
	ads_real sl1, sd, sd1;

	// shown variables
	get_val("d", d);
	get_val("l", l);

	// hidden variables
	get_val("sl1", sl1);
	get_val("sd", sd);
	get_val("sd1", sd1);

	makeCCAV(d, l, sl1, sd, sd1);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRCAV()
	{
	ads_real a, b, l;
	ads_real sa, sb, sl, sl1, sl2, sd, fls;

	// shown variables
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);

	// hidden variables
	get_val("sa", sa);
	get_val("sb", sb);
	get_val("sl", sl);
	get_val("sl1", sl1);
	get_val("sl2", sl2);
	get_val("sd", sd);
	get_val("__fls_left", fls );

	makeRCAV(a, b, l, sa, sb, sl, sl1, sl2, sd, fls);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCVAV()
	{
	ads_real d, l;
	ads_real a, b, e, l1, sl1, sl2, sh1, sh2, sh3, sh4;

	// shown variables
	get_val("d", d);
	get_val("l", l);

	// hidden variables
	get_val("a", a);
	get_val("b", b);
	get_val("e", e);
	get_val("l1", l1);
	get_val("sl1", sl1 );
	get_val("sl2", sl2 );
	get_val("sh1", sh1 );
	get_val("sh2", sh2 );
	get_val("sh3", sh3 );
	get_val("sh4", sh4 );

	makeCVAV(d, l, a, b, e, l1, sl1, sl2, sh1, sh2, sh3, sh4);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRHU()
	{
	ads_real a, b, l;

	ads_real sb, sb1, sa, sa1, sl1, sl2, sl3, s1cp, s2cp, s3cp, s4cp, fls;

	// shown variables
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);

	// hidden variables
	get_val("sb", sb);
	get_val("sb1", sb1);
	get_val("sa", sa);
	get_val("sa1", sa1);
	get_val("sl1", sl1);
	get_val("sl2", sl2);
	get_val("sl3", sl3);
	get_val("s1cp", s1cp);
	get_val("s2cp", s2cp);
	get_val("s3cp", s3cp);
	get_val("s4cp", s4cp);
	get_val("__fls_right", fls);

	makeRHU(a, b, l, sb, sb1, sa, sa1, sl1, sl2, sl3, s1cp, s2cp, s3cp, s4cp, fls);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCOWD()
	{
	ads_real d, l;
	ads_real sl1, sl2, sh1, sh2;

	// shown variables
	get_val("d", d);
	get_val("l", l);
	get_val("sl1", sl1);
	get_val("sl2", sl2);
	get_val("sh1", sh1);
	get_val("sh2", sh2);

	makeCOWD(d, l, sl1, sl2, sh1, sh2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenROWD()
	{
	ads_real a, b, l;
	ads_real sd, sa, sb, sl, sl1, sl2, fls;

	// shown variables
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);

	// hidden variables
	get_val("sd", sd);
	get_val("sa", sa);
	get_val("sb", sb);
	get_val("sl", sl);
	get_val("sl1", sl1);
	get_val("sl2", sl2);
	get_val("__fls_right", fls);

	makeROWD(a, b, l, sd, sa, sb, sl, sl1, sl2, fls);
	return 0;
	};

// By KZ
short SmkGenBlockCreator :: makeGenSB()
	{
	ads_real d, d0, h0;
	ads_real d1, d2, d3, d4, d5, d6, d10, h, h1,h2,h3,h4,h5;

	// shown variables
	get_val("d", d);
	get_val("D", d0);
	get_val("H", h0);

	// hidden variables
	get_val("D1", d1);
	get_val("D2", d2);
	get_val("D3", d3);
	get_val("D4", d4);
	get_val("D5", d5);
	get_val("D6", d6);
	get_val("d1", d10);
	get_val("h", h);
	get_val("h1", h1);
	get_val("h2", h2);
	get_val("h3", h3);
	get_val("h4", h4);
	get_val("h5", h5);

	makeSB(d, d0, h0, d1, d2, d3, d4, d5, d6, d10, h, h1, h2, h3, h4, h5, SEGNUM(d0));
	return 0;
	};

short SmkGenBlockCreator :: makeGenSUC()
	{
	ads_real d, d1, h, z, r, n;

	get_val("d", d);
	get_val("d1", d1);
	get_val("h", h);
	get_val("z", z);
	get_val("r", r);
	get_val("n", n);

	makeSUC(d, d1, h, z, r, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenOKP()
	{
	ads_real a, b, d, g, l, l2, n;

	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("g", g);
	get_val("l", l);
	get_val("l2", l2);
	get_val("n", n);

	makeOKP(a, b, d, g, l, l2, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRDO1()
	{
	ads_real a, b, l, d1, g, n;

	get_val("a", a);
	get_val("b", b);
	get_val("l", l);
	get_val("d1", d1);
	get_val("n", n);
	get_val("g", g);

	makeRDO1(a, b, l, d1, g, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGLE()
	{
	ads_real d, a, b, c, d1, l, n;

	get_val("d", d);
	get_val("a", a);
	get_val("b", b);
	get_val("c", c);
	get_val("d1", d1);
	get_val("l", l);
	get_val("n", n);

	makeGLE(d, a, b, c, d1, l, n);
	return 0;
	};





short SmkGenBlockCreator :: makeGenCH1()
	{
	ads_real a, b, d, l, l2;
	ads_real s1cp, s2cp;

	// shown variables
	get_val("A", a);
	get_val("B", b);
	get_val("d", d);
	get_val("l", l);
	get_val("L", l2);

	// hidden variables
	get_val ("s1cp", s1cp);
	get_val ("s2cp", s2cp);

	makeCH1(a, b, d, l, l2, s1cp, s2cp, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCH2()
	{
	ads_real d, l;
	ads_real s1cp, s2cp, a, b, e;

	// shown variables
	get_val("d", d);
	get_val("l", l);

	// hidden variables
	get_val ("s1cp", s1cp);
	get_val ("s2cp", s2cp);
	get_val("a", a);
	get_val("b", b);
	get_val("e", e);

	makeCH2(d, l, s1cp, s2cp, a, b, e, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRV1()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRV1(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCV1()
	{
	ads_real d, l, l2;
	get_val("d", d);
	get_val("l", l);
	get_val("l2", l2);

	makeCV1(d, l, l2, d + 100, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCV2()
	{
	ads_real d, l2;
	get_val("d", d);
	get_val("l2", l2);

	makeCV2(d, l2, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCV3()
	{
	ads_real d, l2;
	get_val("d", d);
	get_val("l2", l2);

	makeCV3(d, 2 * d, l2, l2, SQRT_2 * d / 2, SEGNUM(d));
	return 0;
	};





// Created by PK
short SmkGenBlockCreator :: makeGenCRAF()
	{
	ads_real d1, d2;
	ads_real d0, h1, h2, l1, l2, l3, l4;
	ads_real d10, r0;

	// shown variables
	get_val ("d1", d1);
	get_val ("d2", d2);

	// hidden variables
	get_val ("D", d0);
	get_val ("H1", h1);
	get_val ("H2", h2);
	get_val ("L1", l1);
	get_val ("L2", l2);
	get_val ("L3", l3);
	get_val ("L4", l4);

	get_val ("D1", d10);
	get_val ("R", r0);

	makeCRAF(d1, d2, d0, h1, h2, l1, l2, l3, l4, d10, r0, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRRAF()
	{
	ads_real a, b, d1, c, d;
	ads_real d0, h1, h2, l1, l2, l3, l4;
	ads_real d10, r0;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("d1", d1);
	get_val ("c", c);
	get_val ("d", d);

	// hidden variables
	get_val ("D", d0);
	get_val ("H1", h1);
	get_val ("H2", h2);
	get_val ("L1", l1);
	get_val ("L2", l2);
	get_val ("L3", l3);
	get_val ("L4", l4);

	get_val ("D1", d10);
	get_val ("R", r0);

	makeRRAF(a, b, d1, c, d, d0, h1, h2, l1, l2, l3, l4, d10, r0, SEGNUM(d1));
	return 0;
	};





short SmkGenBlockCreator :: makeGenRRD1()
	{
	ads_real l, l2, l3, l4, ad, bd, a, b;
	get_val("a", ad);
	get_val("b", bd);
	get_val("A", a);
	get_val("B", b);
	get_val("l", l);
	get_val("l2", l2);
	get_val("l3", l3);
	get_val("l4", l4);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRRD1(ad, bd, a, b, l, l2, l3, l4, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCRD1()
	{
	ads_real d, l, l2, a, b;
	get_val("d", d);
	get_val("A", a);
	get_val("B", b);
	get_val("l", l);
	get_val("l2", l2);

	double th = ((a > b) ? (a - d) : (b - d)) * tan(M_PI / 18.0) / 2.0;
	makeCRD1(d, l, 50, th, 100, l2, a, b, SEGNUM(n));
	return 0;
	};

short SmkGenBlockCreator :: makeGenBA()
	{
	ads_real alpha;
	ads_real a, b, d;
	ads_real r, e, f;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("r", r);
	get_val("alfa", alpha);
	get_val("e", e);
	get_val("f", f);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeBA(alpha, a, b, d, e, f, r, SEGNUM(2 * r), flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenBO()
	{
	ads_real a, b;
	get_val("a", a);
	get_val("b", b);

	ads_real flange_1;
	get_val("__flange_1", flange_1);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;

	makeBO(a, b, flange_1);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCR5()
	{
	ads_real a, b, d, h, j, e, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("h", h);
	get_val("j", j);
	get_val("e", e);
	get_val("l", l);

	ads_real flange_1, flange_2, flange_3, flange_4;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	get_val("__flange_4", flange_4);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;
	if( flange_4 <= 0 )  flange_4 = CONNECTOR_SIZE_N;

	makeCR5(a, b, d, h, j, e, l, flange_1, flange_2, flange_3, flange_4);
	return 0;
	};

short SmkGenBlockCreator :: makeGenEA()
	{
	ads_real a, b, d, e, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("e", e);
	// get_val("f", f);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeEA(a, b, d, e, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenHS()
	{
	ads_real a, b, h, d, e, m, l;
	get_val("a", a);
	get_val("b", b);
	get_val("h", h);
	get_val("d", d);
	get_val("e", e);
	get_val("m", m);
	get_val("l", l);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeHS(a, b, d, h, e, m, l, flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenK()
	{
	ads_real a, b, l;
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);

#ifdef __TODO__AUX
	CString lp;
	get_val("lp", lp);
#endif

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeK(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRA()
	{
	ads_real a, b, d, e, f, g, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("e", e);
	get_val("f", f);
	get_val("g", g);
	get_val("l", l);

	ads_real flange_1;
	get_val("__flange_1", flange_1);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;

	makeRA(a, b, d, l, g, e, f, fo, fs, SEGNUM(n), flange_1);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRS()
	{
	ads_real a, b, d, g, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("g", g);
	get_val("l", l);

	ads_real flange_1;
	get_val("__flange_1", flange_1);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;

	ads_real f = -a / 2 + d / 2, e = -b / 2 + d / 2;
	makeRA(a, b, d, l, g, e, f, fo, fs, SEGNUM(n), flange_1);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTA()
	{
	ads_real a, b, d, h, e, f, r, m, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("h", h);
	get_val("e", e);
	get_val("f", f);
	get_val("r", r);
	get_val("m", m);
	get_val("l", l);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTA(a, b, d, h, e, f, r, m, l, SEGNUM(2 * r), flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTG()
	{
	ads_real a, b, d, h, e, f, r, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("h", h);
	get_val("e", e);
	get_val("f", f);
	get_val("r", r);
	get_val("l", l);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTG(a, b, d, h, e, f, r, l, SEGNUM(2 * r), flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR1()
	{
	ads_real a, b, h, g, e, f, l, l3;
	get_val("a", a);
	get_val("b", b);
	get_val("h", h);
	get_val("g", g);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);
	get_val("l3", l3);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR1(a, b, g, h, l, e, f, l3, flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR2()
	{
	ads_real a, b, d, e, f, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeTR2a(a, b, b, d, l, fo, e, f, SEGNUM(d), flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR3()
	{
	ads_real a, b, d, h, r;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("h", h);
	get_val("r", r);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR3(a, b, d, h, r, SEGNUM(d), flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR4()
	{
	ads_real a, b, d, h, alpha, l, r;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("h", h);
	get_val("alfa", alpha);
	get_val("l", l);
	get_val("r", r);

	makeTR4(a, b, d, h, r, l, alpha, SEGNUM(2 * r));
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR6()
	{
	ads_real a, b, d, g, h, e;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("g", g);
	get_val("h", h);
	get_val("e", e);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR6(a, b, d, g, h, e, flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR7()
	{
	ads_real a, b, d, g, l, r;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("g", g);
	get_val("r", r);
	get_val("l", l);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR7(a, b, d, g, r, l, SEGNUM(2 * r), flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR8()
	{
	ads_real a, b, d, g, l, r;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("g", g);
	get_val("l", l);
	get_val("r", r);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR8(a, b, d, g, r, l, SEGNUM(2 * r), flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenUA()
	{
	ads_real a, b, c, d, e, f, l;
	get_val("a", a);
	get_val("b", b);
	get_val("c", c);
	get_val("d", d);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeUA(a, b, c, d, l, e, f, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenUS()
	{
	ads_real a, b, c, d, l;
	get_val("a", a);
	get_val("b", b);
	get_val("c", c);
	get_val("d", d);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	ads_real e = (d - b) / 2, f = (c - a) / 2;
	makeUA(a, b, c, d, l, e, f, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenWA()
	{
	ads_real alpha;
	ads_real a, b, d;
	ads_real r, e, f;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("e", e);
	get_val("f", f);
	get_val("r", r);
	get_val("alfa", alpha);

#ifdef __TODO__AUX
	// get_val("la", la);
	// get_val("lc", lc);
	la = e - fo;  lc = f - fo;
#endif

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeWA(alpha, a, b, d, e, f, r, SEGNUM(r), flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCR1()
	{
	ads_real a, b, h, g, e, f, l, l3;
	get_val("a", a);
	get_val("b", b);
	get_val("h", h);
	get_val("g", g);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);
	get_val("l3", l3);

	ads_real flange_1, flange_2, flange_3, flange_4;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	get_val("__flange_4", flange_4);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;
	if( flange_4 <= 0 )  flange_4 = CONNECTOR_SIZE_N;

	makeCR1(a, b, g, h, l, e, f, l3, flange_1, flange_2, flange_3, flange_4);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCR2()
	{
	ads_real a, b, d, e, f, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d1", d);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeCR2(a, b, d, l, fo, e, f, SEGNUM(d), flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR1a()
	{
	ads_real a, b, h, g, e, f, l, l3, d;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("h", h);
	get_val("g", g);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);
	get_val("l3", l3);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR1a(a, b, d, g, h, l, e, f, l3, flange_1, flange_2, flange_3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR2a()
	{
	ads_real a, b, d, d1, e, f, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d1", d1);
	get_val("d", d);
	get_val("e", e);
	get_val("f", f);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeTR2a(a, b, d, d1, l, fo, e, f, SEGNUM(d), flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTR9()
	{
	ads_real a, b, d, g, r, l;
	get_val("a", a);
	get_val("b", b);
	get_val("d", d);
	get_val("g", g);
	get_val("r", r);
	get_val("l", l);

	ads_real flange_1, flange_2, flange_3;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	get_val("__flange_3", flange_3);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;
	if( flange_3 <= 0 )  flange_3 = CONNECTOR_SIZE_N;

	makeTR9(a, b, d, g, r, l, SEGNUM(2 * r), flange_1, flange_2, flange_3);
	return 0;
	};










short SmkGenBlockCreator :: makeGenAP1()
	{
	ads_real d;
	get_val("d1", d);

	makeAP1(d, fo, fs, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenARE()
	{
	ads_real d1, d2, d3, l1, l3, l4;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("d3", d3);
	get_val("l1", l1);
	get_val("l3", l3);
	get_val("l4", l4);

	int n[2];
	n[0] = SEGNUM(d1);
	n[1] = SEGNUM(d3);

	if( !d2 || d1 == d2 )
		makeATE(l1, l3, 0, d1, d3, n);
	else
		makeARE(l1, l1 - l4, 0, 0, d1, d2, d3, n, l3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenAYE()
	{
	ads_real d1, d3, l1, l3;
	get_val("d1", d1);
	get_val("d3", d3);
	get_val("l1", l1);
	get_val("l3", l3);

	makeAYE(l1, l3, 0, d1, d3, 45, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenBGE()
	{
	long n;
	ads_real alpha;
	ads_real d1, r;
	get_val("alfa", alpha);
	get_val("d1", d1);
	get_val("r", r);
	get_val("n", n);

	if( n < 2 )
		{
		n = SEGNUM(2 * r * d1);
		makeBGE(d1, r, alpha, SEGNUM(d1), n);
		}
	else
		makeBSE(d1, r, alpha, SEGNUM(d1), n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCP1()
	{
	ads_real d1, d3, l1, l3;
	get_val("d1", d1);
	get_val("d3", d3);
	get_val("l1", l1);
	get_val("l3", l3);

	makeCP1(l1, l3, 0, d1, d3, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenDFA()
	{
	ads_real d1;
	get_val("d1", d1);

	makeDFA(d1, fo, fs, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenHSE()
	{
	ads_real d1, d2, l1, alfa;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("l1", l1);
	get_val("alfa", alfa);

	makeHSE(d1, d2, l1, alfa, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenKXE()
	{
	ads_real d1, d3, l1, l3;
	get_val("d1", d1);
	get_val("d3", d3);
	get_val("l1", l1);
	get_val("l3", l3);

	makeKXE(l1, l3, 0, d1, d3, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenMFA()
	{
	ads_real d1, b, l2;
	get_val("d1", d1);
	get_val("b", b);
	get_val("l2", l2);

	makeMFA(d1, b + 2 * l2, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenOC1()
	{
	ads_real d1, l1, l2, e;
	get_val("d1", d1);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("e", e);

	makeOC1(d1, l1, l2, e, SEGNUM(D1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenSTE()
	{
	ads_real d1, d3, l5;
	get_val("d1", d1);
	get_val("d3", d3);
	get_val("l5", l5);

	makeSTE(d1, d3, l5, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenTC1()
	{
	ads_real d1, a, b, e, l1;
	get_val("d1", d1);
	get_val("a", a);
	get_val("b", b);
	get_val("e", e);
	get_val("l1", l1);

	ads_real flange_1;
	get_val("__flange_1", flange_1);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;

	makeTC1(d1, l1, a, b, e, SEGNUM(d1), flange_1);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTC2()
	{
	ads_real d1, d2, d3, l1, l3;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("d3", d3);
	get_val("l1", l1);
	get_val("l3", l3);

#ifdef __TODO__AUX
	ads_real l4;
	get_val("l4", l4);
#endif

	if( !l1 )  l1 = d3 + 240;
	if( !l3 )
		l3 = ( (d1 >= d2) ? d1 : d2 ) / 2 + 100 - vfh;

	makeTC2(d1, d2, d3, l1, l3, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenTC3()
	{
	ads_real d1, d3, l1, l3;
	get_val("d1", d1);
	get_val("d3", d3);
	get_val("l1", l1);
	get_val("l3", l3);

	makeTC3(d1, d3, l1, l3, 0, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenTUBE()
	{
	ads_real d1, l1;
	get_val("d1", d1);
	get_val("l1", l1);

	makeTUBE(d1, l1, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenUAE()
	{
	ads_real d1, d2, l1;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("l1", l1);

	makeUAE(d1, d2, l1, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenUSE()
	{
	ads_real d1, d2, l1;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("l1", l1);

	makeUSE(d1, d2, l1, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCFD1()
	{
	ads_real d, l;
	get_val("d", d);
	get_val("l", l);

	double thick = min(32, 0.05 * d);
	makeCFD1(l, d, SEGNUM(d), l / 2.0, thick, SEGNUM(d), 50, l / 2.0, 25, d, 25);
	return 0;
	};

short SmkGenBlockCreator :: makeGenASV()
	{
	ads_real d1, l1, l2, n;

	get_val("d1", d1);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("n", n);

	makeASV(d1, l1, l2, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCOLL()
	{
	ads_real d, d1, h, h1, n;

	get_val("d", d);
	get_val("d1", d1);
	get_val("h", h);
	get_val("h1", h1);
	get_val("n", n);

	makeCOLL(d, d1, h, h1, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenXSVL()
	{
	ads_real l1, l2, d1, d3, angle, n;

	get_val("l1", l1);
	get_val("l2", l2);
	get_val("d1", d1);
	get_val("d3", d3);
	get_val("angle", angle);
	get_val("n", n);

	makeXSVL(l1, l2, d1, d3, angle, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenBPBKC()
	{
	ads_real d1, d3, alfa, r, l, n;

	get_val("d1", d1);
	get_val("d3", d3);
	get_val("alfa", alfa);
	get_val("r", r);
	get_val("l", l);
	get_val("n", n);

	makeBPBKC(d1, d3, alfa, r, l, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenILSV45()
	{
	ads_real d1, d2, alfa, lm, l, l2, n;

	get_val("d1", d1);
	get_val("d2", d2);
	get_val("alfa", alfa);
	get_val("lm", lm);
	get_val("l", l);
	get_val("l2", l2);
	get_val("n", n);

	makeILSV45(d1, d2, alfa, lm, l, l2, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTRI45_90()
	{
	ads_real diam1, diam2, diam3, alfa, l1, l2, l3;

	get_val("diam1", diam1);
	get_val("diam2", diam2);
	get_val("diam3", diam3);
	get_val("alfa", alfa);
	get_val("l1", l1);
	get_val("l2", l2);
	get_val("l3", l3);

	makeTRI45_90(diam1, diam2, diam3, alfa, l1, l2, l3);
	return 0;
	};

short SmkGenBlockCreator :: makeGenDCSD()
	{
	ads_real d, l;
	get_val("d", d);
	get_val("l", l);

	double thick = min(32, 0.05 * d);
	makeCFD1(l, d, SEGNUM(d), l / 2.0, thick, SEGNUM(d), 50, l / 2.0, 25, d, 25);
	// makeGrDCSD(d, l);
	return 0;
	};

short SmkGenBlockCreator :: makeGenDRSD()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeDRSD(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenDWSD()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeDWSD(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenFV1()
	{
	ads_real d, l2;
	get_val("d", d);
	get_val("l2", l2);

	ads_real dd = d + 50;
	makeFV1(d, d, dd, l2, SEGNUM(dd));
	return 0;
	};

short SmkGenBlockCreator :: makeGenOWSD()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeOWSD(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRFD1()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeRFD1(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenSSD()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeSSD(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTSD()
	{
	ads_real a, b, l;
	get_val("a", b);
	get_val("b", a);
	get_val("l", l);

	ads_real flange_1, flange_2;
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);
	if( flange_1 <= 0 )  flange_1 = CONNECTOR_SIZE_N;
	if( flange_2 <= 0 )  flange_2 = CONNECTOR_SIZE_N;

	makeTSD(a, b, l, flange_1, flange_2);
	return 0;
	};




















// General - Diffusion

short SmkGenBlockCreator :: makeGenGrBCD1()
	{
	ads_real na, d, rh, bd;
	get_val("D", na);
	get_val("D2", d);
	get_val("T", rh);
	get_val("bd", bd);

	ads_real l, h;
	// get_val("L", l);
	// get_val("H", h);
	h = l = d + 100;

	makeBCD1(na, d, bd, rh, h, l, SEGNUM(na));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrBLD1()
	{
	ads_real l, h, bd, d, hk;
	get_val("L", l);
	get_val("H", h);
	get_val("bd", bd);
	get_val("D", d);
	get_val("T", hk);

	ads_real a = 50;
	int m = int(floor(h / a));

	makeBLD1(d, bd, hk, h, l, SEGNUM(d), m, a);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrBRD1()
	{
	ads_real na, l, h, rh, bd;
	get_val("L", l);
	get_val("H", h);
	get_val("D", na);
	get_val("T", rh);
	get_val("bd", bd);

	makeBRD1(na, bd, rh, h + 60, l + 60, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrBRG1()
	{
	ads_real d, l, h, hk, bd;
	get_val("D", d);
	get_val("L", l);
	get_val("H", h);
	get_val("T", hk);
	get_val("bd", bd);

	makeBRG1(d, bd, hk, h, l, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrBSCD1()
	{
	ads_real na, d, rh, bd;
	get_val("D", na);
	get_val("D2", d);
	get_val("T", rh);
	get_val("bd", bd);

	ads_real l, h;
	// get_val("L",l);
	// get_val("H",h);
	l = h = d + 100;

	makeBSCD1(na, d, bd, rh, l, h, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrBSRD1()
	{
	ads_real na, l, h, rh, bd;
	get_val("D", na);
	get_val("L", l);
	get_val("H", h);
	get_val("T", rh);
	get_val("bd", bd);

#ifdef __TODO__AUX
	ads_real d, d1;
	d1 = (h > l) ? l : h;  d = d1 - 10;
#endif

	makeBSRD1(na, bd, rh, h, l, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrCG1()
	{
	ads_real w, h, D;
	get_val("L", w);
	get_val("H", h);
	get_val("D", D);

	makeGrCG1(w, h, D, 30, w / 10);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrLD1()
	{
	ads_real w, h, n;
	get_val("L", w);
	get_val("H", h);
	get_val("n", n);

	makeGrLD1(w, h, n, 20);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrPPD1()
	{
	ads_real w, h;
	get_val("L", w);
	get_val("H", h);

	makeGrPPD1(w, h);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrRG1()
	{
	ads_real w, h;
	get_val("L", w);
	get_val("H", h);

	double alfa = 45;
	double thickness = 25;
	double frame = 25;

	makeGrRG1(w, h, frame, thickness, alfa);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrCD1()
	{
	ads_real d, d1;
	get_val("D2", d);
	get_val("D", d1);
	if( !d1 )  d1 = d + 100;

	// "+ 5" shouldn't be necessary...
	makeGrCD1(d, 0.25 * d1, d1 + 5, 3, SEGNUM(d1), 0, 25);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrJD1()
	{
	ads_real d2;
	get_val("D", d2);
	ads_real d1 = d2 / 2.5;

	makeGrJD1(1.5 * d1, d1, 1.25 * d1, 2.25 * d1, 2.2535 * d1 / 2.0, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrRD1()
	{
	ads_real l, h;
	get_val("L", l);
	get_val("H", h);

	makeGrRD1(l, h, 25, 25, 45);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrSCD1()
	{
	ads_real d, d1;
	get_val("D2", d);
	get_val("D1", d1);
	if( !d1 )  d1 = d + 100;

	// makeGrSCD1(0.8 * d1, 0.3 * d1, d1, 6, 25, 60, SEGNUM(d));
	makeGrSCD1(d, 0.3 * d1, d1, 6, 25, 60, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrSRD1()
	{
	ads_real l, h ;
	get_val("L", l);
	get_val("H", h);

#ifdef __TODO__AUX
	ads_real d, d1, k;
	// get_val("D", d);
	// get_val("D1", d1);
	d1 = ( l < h ) ? l : h;  d = d1 - 10;
#endif

	ads_real d1 = ( l < h ) ? l : h;
	makeGrSRD1(l, h, 60, 6, 25, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrVV1()
	{
	ads_real d;
	get_val("D", d);
	ads_real h = 20, m = 35;

	makeGrVV1(d, d, d + m, h, SEGNUM(d + m));
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrNKSWA()
	{
	ads_real d, a, b, l, n;
	get_val("d", d);
	get_val("a", a);
	get_val("b", b);
	get_val("l", l);
	get_val("n", n);

	makeGrNKSWA(d, a, b, l, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrKHA()
	{
	ads_real d1, d2, d3, f, l, e, n;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("d3", d3);
	get_val("f", f);
	get_val("l", l);
	get_val("e", e);
	get_val("n", n);

	makeGrKHA(d1, d2, d3, f, l, e, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrKPP()
	{
	ads_real d1, d2, L, h, ds, hs, n;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("L", L);
	get_val("h", h);
	get_val("ds", ds);
	get_val("hs", hs);
	get_val("n", n);

	makeGrKPP(d1, d2, L, h, ds, hs, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenGrNIM()
	{
	ads_real d1, d2, h;
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("h", h);

	makeGrNIM( d1, d2, h );
	return 0;
	};





short SmkGenBlockCreator :: makeGenCFC()
	{
	ads_real d, l;
	get_val("d", d);
	get_val("l", l);

	makeCFC(d, d - 20, d + 20, l, 20, 40, SEGNUM(n));
	return 0;
	};


short SmkGenBlockCreator :: makeGenRFC()
	{
	ads_real a, b, l;
	ads_real flange_1, flange_2;

	get_val("a", b);
	get_val("b", a);
	get_val("l", l);
	get_val("__flange_1", flange_1);
	get_val("__flange_2", flange_2);

	makeRFC(a, b, l, flange_1, flange_2);
	return 0;
	};

short SmkGenBlockCreator :: makeGenIRIS()
	{
	ads_real d1, d2, l, n;

	get_val("d1", d1);
	get_val("d2", d2);
	get_val("l", l);
	get_val("n", n);

	makeIRIS(l, d1, d2, SEGNUM(d1));
	return 0;
	};




















// Outdoor grills

short SmkGenBlockCreator :: makeGenRRC1()
	{
	ads_real a, b, l;
	ads_real flange_1;

	get_val("a", a);
	get_val("b", b);
	get_val("l", l);
	get_val("__flange_1", flange_1);

	makeRRC1(a, b, l, flange_1);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCRC1()
	{
	ads_real d, l, ld;
	get_val("d", d);
	get_val("l", l);
	// get_val("l2", l2);

	if( l == 0 )
		l = 1.7 * d;
	ld = 13 * l / 17;
	// makeCRC1(D, D1, H, H1, H2, pillar_t, baseN, roofN)
	makeCRC1(d, 2 * d, l, ld / 3.0, l - ld, d / 18, SEGNUM(d), SEGNUM(2 * d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenWG()
	{
	ads_real a, b;
	ads_real flange_1;

	get_val("a", a);
	get_val("b", b);
	get_val("__flange_1", flange_1);

	makeWG(a, b, int(a) / 100, 45, 40, flange_1);
	return 0;
	};





// Created by PK
short SmkGenBlockCreator :: makeGenRRCB()
	{
	ads_real a, b, a0, b0, h0;
	ads_real h, h1, h2, h3, c, d;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("A", a0);
	get_val ("B", b0);
	get_val ("H", h0);

	// hidden variables
	get_val ("h", h);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("c", c);
	get_val ("d", d);

	makeRRCB(a, b, a0, b0, h0, h, h1, h2, h3, c, d);
	return 0;
	};

short SmkGenBlockCreator :: makeGenCRCD()
	{
	ads_real d, d0, h0;
	ads_real d1,d2,h1;

	// shown variables
	get_val ("d", d);
	get_val ("D", d0);
	get_val ("H", h0);

	// hidden variables
	get_val ("D1", d1);
	get_val ("D2", d2);
	get_val ("h1", h1);

	makeCRCD(d, d0, h0, d1, d2, h1, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCRCE()
	{
	ads_real d, d1, d2, h0;
	ads_real h1, h2, h3, h4, d0, d3;

	// shown variables
	get_val ("d", d);
	get_val ("D1", d1);
	get_val ("D2", d2);
	get_val ("H", h0);

	// hidden variables
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("h4", h4);
	get_val ("D", d0);
	get_val ("D3", d3);

	makeCRCE(d, d1, d2, h0, h1, h2, h3, h4, d0, d3, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCRCG()
	{
	ads_real d, d1, d2, h0;
	ads_real d3, d4, d5, d6;
	ads_real h, h1, h2, h3, h4, h5, h6;

	// shown variables
	get_val ("d", d);
	get_val ("D1", d1);
	get_val ("D2", d2);
	get_val ("H", h0);

	// hidden variables
	get_val ("D3", d3);
	get_val ("D4", d4);
	get_val ("D5", d5);
	get_val ("D6", d6);

	get_val ("h", h);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("h4", h4);
	get_val ("h5", h5);
	get_val ("h6", h6);

	makeCRCG(d, d1, d2, h0, d3, d4, d5, d6, h, h1, h2, h3, h4, h5, h6, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCWG()
	{
	ads_real d, l, d1, h;

	// shown variables
	get_val ("d", d);
	get_val ("l", l);

	// hidden variables
	get_val ("d1", d1);
	get_val ("h", h);

	makeCWG(d, l, d1, h, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCRWG()
	{
	ads_real d, b, a, l, l1;

	// shown variables
	get_val ("d", d);
	get_val ("b", b);
	get_val ("a", a);

	// hidden variables
	get_val ("l", l);
	get_val ("l1", l1);

	makeCRWG(d, b, a, l, l1, SEGNUM(d));
	return 0;
	};

short SmkGenBlockCreator :: makeGenCDD()
	{
	ads_real d0, d1, h0;
	ads_real h1, h2, h3, h4, h5, l1;

	// shown variables
	get_val ("D", d0);
	get_val ("D1", d1);
	get_val ("H", h0);

	// hidden variables
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("h4", h4);
	get_val ("h5", h5);
	get_val ("l1", l1);

	makeCDD(d0, d1, h0, h1, h2, h3, h4, h5, l1, SEGNUM(d0));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRDD()
	{
	ads_real d0, a0, b0, h0;
	ads_real h1, h2, h3, h4, h5, l1, l2;

	// shown variables
	get_val ("D", d0);
	get_val ("A", a0);
	get_val ("B", b0);
	get_val ("H", h0);

	// hidden variables
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("h4", h4);
	get_val ("h5", h5);
	get_val ("l1", l1);
	get_val ("l2", l2);

	makeRDD(d0, a0, b0, h0, h1, h2, h3, h4, h5, l1, l2, SEGNUM(d0));
	return 0;
	};

short SmkGenBlockCreator :: makeGenRES()
	{
	ads_real a, b, e, s, d, n;
	ads_real h1, h2, h3, l1, l2, fls_down, fls_right;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("e", e);
	get_val ("s", s);
	get_val ("d", d);
	get_val ("n", n);

	// hidden variables
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("l1", l1);
	get_val ("l2", l2);
	get_val ("__fls_down", fls_down);
	get_val ("__fls_right", fls_right);

	makeRES(a, b, e, s, d, n, h1, h2, h3, l1, l2, fls_down, fls_right);
	return 0;
	};

short SmkGenBlockCreator :: makeGenRRS()
	{
	ads_real a, b, a0, b0, h0, f0, alfa;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("A", a0);
	get_val ("B", b0);
	get_val ("H", h0);
	get_val ("F", f0);
	get_val ("alfa", alfa);

	makeRRS(a, b, a0, b0, h0, f0, alfa);
	return 0;
	};

short SmkGenBlockCreator :: makeGenKSO()
	{
	ads_real d, l, l2;

	get_val ("d", d);
	get_val ("l", l);
	get_val ("l2", l2);

	return 0;
	};

short SmkGenBlockCreator :: makeGenUSMS()
	{
	ads_real d, l, l2, a, b, n;

	get_val ("d", d);
	get_val ("l", l);
	get_val ("l2", l2);
	get_val ("a", a);
	get_val ("b", b);
	get_val ("n", n);

	makeUSMS(d, l, l2, a, b, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenTAGF()
	{
	ads_real d1, A, B, l, thic, alfa, n;

	get_val ("d1", d1);
	get_val ("A", A);
	get_val ("B", B);
	get_val ("l", l);
	get_val ("thic", thic);
	get_val ("alfa", alfa);
	get_val ("n", n);

	makeTAGF(d1, A, B, l, thic, alfa, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenWDQE()
	{
	ads_real c, h, a, b, n;

	get_val ("c", c);
	get_val ("h", h);
	get_val ("a", a);
	get_val ("b", b);
	get_val ("n", n);

	makeWDQE(c, h, a, b, n);
	return 0;
	};

short SmkGenBlockCreator :: makeGenUSLA()
	{
	ads_real d1, a, b, l1, angle, seg, n;

	get_val ("d1", d1);
	get_val ("a", a);
	get_val ("b", b);
	get_val ("l1", l1);
	get_val ("angle", angle);
	get_val ("seg", seg);
	get_val ("n", n);

	makeUSLA(d1, a, b, l1, angle, seg, n);
	return 0;
	};





// Karpol elements
short SmkGenBlockCreator :: makeKarKWO()
	{
	ads_real d1, h1, S;

	// shown variables
	get_val ("d1", d1);
	get_val ("h1", h1);
	get_val ("s", S);

	makeKWO(d1, h1, S, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeKarWDPE()
	{
	ads_real a, b, c, d, x, y, z ,h, h2, s;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("z", z);
	get_val ("h", h);
	get_val ("h2", h2);
	get_val ("s", s);

	makeWDPE(a, b, c, d, x, y, z ,h, h2, s);
	return 0;
	};

short SmkGenBlockCreator :: makeKarWDOE()
	{
	ads_real d1, d2, d3, h1, h2, h, e ,s;

	// shown variables
	get_val ("d1", d1);
	get_val ("d2", d2);
	get_val ("d3", d3);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h", h);
	get_val ("e", e);
	get_val ("s", s);

	makeWDOE(d1, d2, d3, h1, h2, h, e ,s);
	return 0;
	};

short SmkGenBlockCreator :: makeKarWDPB()
	{
	ads_real a, b, c, d, x, y, z ,h, h2, s, s1;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("z", z);
	get_val ("h", h);
	get_val ("h2", h2);
	get_val ("s", s);
	get_val ("s1", s1);

	makeWDPB(a, b, c, d, x, y, z ,h, h2, s, s1);
	return 0;
	};

short SmkGenBlockCreator :: makeKarCDPB()
	{
	ads_real a, b, c, d, x, y, z ,h, h2, s, s1;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("z", z);
	get_val ("h", h);
	get_val ("h2", h2);
	get_val ("s", s);
	get_val ("s1", s1);

	makeCDPB(a, b, c, d, x, y, z ,h, h2, s, s1);
	return 0;
	};

short SmkGenBlockCreator :: makeKarRRC1()
	{
	ads_real a, b, c, d, x, y, z ,h, h2, s, s1;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("z", z);
	get_val ("h", h);
	get_val ("h2", h2);
	get_val ("s", s);
	get_val ("s1", s1);

	makeWDPA(a, b, c, d, x, y, z ,h, h2, s, s1);
	return 0;
	};

short SmkGenBlockCreator :: makeKarWC()
	{
	ads_real d1, d2 ,d3 , d4, s1, h, h2 ,h3, l2, l3;

	// shown variables
	get_val ("d", d1);
	get_val ("d2", d2);
	get_val ("d3", d3);
	get_val ("d4", d4);
	get_val ("h", h);
	get_val ("s1", s1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("l2", l2);
	get_val ("l3", l3);

	makeWC(d1, d2 ,d3 , d4, s1, h, h2 ,h3, l2, l3);
	return 0;
	};

short SmkGenBlockCreator :: makeKarCP()
	{
	ads_real a, b, c ,d, h1, h2, f , kt ;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("f", f);
	get_val ("kt", kt);

	makeCP(a, b, c ,d, h1, h2, f , kt);
	return 0;
	};

short SmkGenBlockCreator :: makeKarCDPA()
	{
	ads_real a, b, c, d, x, y, z ,h, h2, s1;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("z", z);
	get_val ("h", h);
	get_val ("h2", h2);
	get_val ("s1", s1);

	makeCDPA(a, b, c, d, x, y, z ,h, h2, s1);
	return 0;
	};

short SmkGenBlockCreator :: makeKarPDOBI()
	{
	ads_real d1, d2, h1, h2, h3, a , b;

	// shown variables
	get_val ("d1", d1);
	get_val ("d2", d2);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("a", a);
	get_val ("b", b);

	makePDOBI(d1, d2, h1, h2, h3, a , b);
	return 0;
	};

short SmkGenBlockCreator :: makeKarPDOBII()
	{
	ads_real d1, d2, h1, h2, h3, a , b, L;

	// shown variables
	get_val ("d1", d1);
	get_val ("d2", d2);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("a", a);
	get_val ("b", b);
	get_val ("L", L);

	makePDOBII(d1, d2, h1, h2, h3, a , b, L);
	return 0;
	};

short SmkGenBlockCreator :: makeKarWDOC()
	{
	ads_real d1, d2,d3, h1, h2, h3, L;

	// shown variables
	get_val ("d1", d1);
	get_val ("d2", d2);
	get_val ("d3", d3);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("L", L);

	makeWDOC(d1, d2, d3, h1, h2, h3, L);
	return 0;
	};

short SmkGenBlockCreator :: makeKarCDOC()
	{
	ads_real d1, d2, h2, h1, L;

	// shown variables
	get_val ("d1", d1);
	get_val ("d2", d2);
	get_val ("h2", h2);
	get_val ("h1", h1);
	get_val ("L", L);

	makeCDOC(d1, d2, h2, h1, L);
	return 0;
	};

short SmkGenBlockCreator :: makeKarPDPAI()
	{
	ads_real a, b, c, d, x, y, h1, h2, X;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("X", X);

	makePDPAI(a, b, c, d, x, y, h1, h2, X);
	return 0;
	};

short SmkGenBlockCreator :: makeKarPDPAII()
	{
	ads_real a, b, c, d, x, y, h1, h2, X, L;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("c", c);
	get_val ("d", d);
	get_val ("x", x);
	get_val ("y", y);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("X", X);
	get_val ("l", L);

	makePDPAII(a, b, c, d, x, y, h1, h2, X,L);
	return 0;
	};

short SmkGenBlockCreator :: makeKarKWP()
	{
	ads_real a, b, a1, b1, e, f, g, r;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("a1", a1);
	get_val ("b1", b1);
	get_val ("e", e);
	get_val ("f", f);
	get_val ("g", g);
	get_val ("r", r);

	makeKWP(a, b, a1, b1, e, f, g, r);
	return 0;
	};

short SmkGenBlockCreator :: makeKarCDPK()
	{
	ads_real a, b, a1, b1, h1, h2, h3, h4, h;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("a1", a1);
	get_val ("b1", b1);
	get_val ("h1", h1);
	get_val ("h2", h2);
	get_val ("h3", h3);
	get_val ("h4", h4);
	get_val ("h", h);

	makeCDPK(a, b, a1, b1, h1, h2, h3, h4, h);
	return 0;
	};

short SmkGenBlockCreator :: makeKarSK()
	{
	ads_real a, b, a1, b1, l, l1, g;

	// shown variables
	get_val ("a", a);
	get_val ("b", b);
	get_val ("a1", a1);
	get_val ("b1", b1);
	get_val ("L", l);
	get_val ("L1", l1);
	get_val ("g", g);

	makeSK(a, b, a1, b1, l, l1, g);
	return 0;
	};

short SmkGenBlockCreator :: makeKarARE45()
	{
	ads_real d1, d2, d3, l1, l2, l3;

	// shown variables
	get_val("d1", d1);
	get_val("d2", d2);
	get_val("d3", d3);
	get_val("l1", l1);

	// hidden variables
	get_val("l2", l2);
	get_val("l3", l3);

	makeARE45(d1, d2, d3, l1, l2, l3);
	return 0;
	};

short SmkGenBlockCreator :: makeKarRRD()
	{
	ads_real d1, a, b;
	ads_real h, h1, h2, l, f, c, d, a0, b0;

	// shown variables
	get_val("d1",d1);
	get_val("a", a);
	get_val("b", b);

	// hidden variables
	get_val("h", h);
	get_val("h1", h1);
	get_val("h2", h2);
	get_val("l", l);
	get_val("f", f);
	get_val("c", c);
	get_val("d", d);
	get_val("A", a0);
	get_val("B", b0);

	makeRRD(d1, a, b, h, h1, h2, l, f, c, d, a0, b0, SEGNUM(d1));
	return 0;
	};

short SmkGenBlockCreator :: makeKarKST()
	{
	ads_real a, b;
	get_val("a", a);
	get_val("b", b);

	makeKST(a, b, int(a) / 20, 15, 20);
	return 0;
	};





// [Prepared by PK 2017.08.24]

// This function adds a single flange: the input vector is
// normal to the flange plane; if it is 'vx', then the flange
// plane is parallel to the Y axis, e.g. it is the YZ plane.

bool SmkGenBlockCreator :: makeRectangularFlange(const FdPoint3d &centralPoint, const FdVector3d &vector, const FdVector3d &upVector, double a, double b, double flange)
{
	if( m_geoRepMode == FLM3Geo::grmSOLID )
		BlockCreator3d::makePlane(centralPoint, vector, upVector, a + 2 * flange, b + 2 * flange);
	else
		{
		double tabWidth[2] = { b, b + 2 * flange };
		double tabHeight[2] = { a, a + 2 * flange };
		bool sides[4] = { true, true, true, true };
		FdPoint3d centralPointsD[2] = { centralPoint, centralPoint };
		FdVector3d vectorsD[2] = { vector, vector };
		FdVector3d upVectorsD[2] = { upVector, upVector };

		BlockCreator3d::makeBox(1, centralPointsD, vectorsD, upVectorsD, tabWidth, tabHeight, sides, false, false, 5, 5, 0);
		};
	return true;
};
