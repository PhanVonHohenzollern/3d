#ifndef __GENERAL_3D_H__
#define __GENERAL_3D_H__

#include "Geo/PnGeometry3D.h"

// New default flange size
#define CONNECTOR_SIZE_N 30

// Some useful shortcuts for commonly used vectors.
#define xVec FdVector3d::kXAxis
#define yVec FdVector3d::kYAxis
#define zVec FdVector3d::kZAxis
#define orig FdPoint3d::kOrigin

class SmkGenBlockCreator : public FLM3Geo::BlockCreator3d
	{
	public:

		// Exported block creator function
		// FLM3Geo::ErrorStatus MakeBlock3D(const CString &blockName);

		explicit SmkGenBlockCreator( const FLM3Geo::BlockCreator3d &a_rBlockCreator )
			: BlockCreator3d( a_rBlockCreator )  { };

	protected:

		#include "GLECircular.h"
		#include "GLERectangular.h"
		#include "GLEDiffusersAndGrills.h"
		#include "GLEDiffusersAndGrillsWithBoxes.h"
		#include "GLEOutdoorGrills.h"
		#include "GLEAccesories.h"
		#include "GLEVentilators.h"
		#include "GLEFireSecurity.h"
		#include "GLEKarpol.h"


	public:

		// General - Rectangular
		short makeGenBA();
		short makeGenBO();
		short makeGenCR5();
		short makeGenEA();
		short makeGenHS();
		short makeGenK();
		short makeGenRA();
		short makeGenRS();
		short makeGenTA();
		short makeGenTG();
		short makeGenTR1();
		short makeGenTR2();
		short makeGenTR3();
		short makeGenTR4();
		short makeGenTR6();
		short makeGenTR7();
		short makeGenTR8();
		short makeGenUA();
		short makeGenUS();
		short makeGenWA();
		short makeGenCR1();
		short makeGenCR2();
		short makeGenTR1a();
		short makeGenTR2a();
		short makeGenTR9();

		// General - Circular
		short makeGenAP1();
		short makeGenARE();
		short makeGenAYE();
		short makeGenBGE();
		short makeGenCP1();
		short makeGenDFA();
		short makeGenHSE();
		short makeGenKXE();
		short makeGenMFA();
		short makeGenOC1();
		short makeGenSTE();
		short makeGenTC1();
		short makeGenTC2();
		short makeGenTC3();
		short makeGenTUBE();
		short makeGenUAE();
		short makeGenUSE();
		short makeGenASV();
		short makeGenCOLL();
		short makeGenXSVL();
		short makeGenBPBKC();
		short makeGenILSV45();
		short makeGenTRI45_90();

		// General - Accessories
		short makeGenRS1();
		short makeGenCS1();
		short makeGenRD1();
		short makeGenRD2();
		short makeGenCD1();
		short makeGenRF1();
		short makeGenCF1();
		short makeGenRH1();
		short makeGenRH2();
		short makeGenRH3();
		short makeGenCH1();
		short makeGenCH2();
		short makeGenRV1();
		short makeGenCV1();
		short makeGenCV2();
		short makeGenCV3();
		short makeGenCRAF();
		short makeGenRRAF();
		short makeGenRRD1();
		short makeGenCRD1();

		short makeGenCFC();
		short makeGenRFC();
		short makeGenIRIS();

		short makeGenRCC();
		short makeGenCCC();
		short makeGenRVAV();
        short makeGenCCAV();
		short makeGenRCAV();
		short makeGenCVAV();
		short makeGenRHU();
		short makeGenCOWD();
		short makeGenROWD();
		short makeGenSB();

		short makeGenSUC();   // made be TK :D
		short makeGenOKP();   // TK
		short makeGenRDO1();  // for ALNOR library TK
		short makeGenGLE();   // for ALNOR library purpose TK

		// General - Fire Security
		short makeGenCFD1();
		short makeGenDCSD();
		short makeGenDRSD();
		short makeGenDWSD();
		short makeGenFV1();
		short makeGenOWSD();
		short makeGenRFD1();
		short makeGenSSD();
		short makeGenTSD();

		// General - Diffusion
		short makeGenGrBCD1();
		short makeGenGrBLD1();
		short makeGenGrBRD1();
		short makeGenGrBRG1();
		short makeGenGrBSCD1();
		short makeGenGrBSRD1();

		short makeGenGrCG1();
		short makeGenGrLD1();
		short makeGenGrPPD1();
        short makeGenGrRG1();

		short makeGenGrCD1();
		short makeGenGrJD1();
		short makeGenGrRD1();
		short makeGenGrSCD1();
		short makeGenGrSRD1();
		short makeGenGrVV1();
		short makeGenGrNKSWA();
		short makeGenGrKHA();
		short makeGenGrKPP();
		short makeGenGrNIM();

		// General - Outdoor Grilles
		short makeGenRRC1();
		short makeGenCRC1();
		short makeGenWG();
		short makeGenRRCB();
		short makeGenCRCD();
		short makeGenCRCE();
		short makeGenCRCG();
		short makeGenCWG();

		short makeGenCRWG();
		short makeGenCDD();
		short makeGenRDD();
		short makeGenRES();
		short makeGenRRS();
		short makeGenKSO();
		short makeGenUSMS();
		short makeGenTAGF();
		short makeGenWDQE();
		short makeGenUSLA();

		// Karpol
		short makeKarKWO();
		short makeKarWDPE();
		short makeKarWDOE();
		short makeKarWDPB();
		short makeKarCDPB();
		short makeKarRRC1();
		short makeKarWC();
		short makeKarCP();
		short makeKarCDPA();
		short makeKarPDOBI();
		short makeKarPDOBII();
		short makeKarWDOC();
		short makeKarCDOC();
		short makeKarPDPAI();
		short makeKarPDPAII();
		short makeKarKWP();
		short makeKarCDPK();
		short makeKarSK();
		short makeKarARE45();
		short makeKarRRD();
		short makeKarKST();

		bool makeRectangularFlange(const FdPoint3d &centralPoint, const FdVector3d &vector, const FdVector3d &upVector, double a, double b, double flange);

		// Chemowent
		#include "GLEChemowent.h"

		// Alnor
		#include "GLEAlnor.h"

		// SZYMOR
		#include "GLESzymor.h"

		// LINDAB
		#include "GLELindab.h"
	};

#endif
