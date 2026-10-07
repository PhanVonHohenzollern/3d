
#ifndef __GEO_TGENERAL_H__
#define __GEO_TGENERAL_H__

#include "Geo/PnGeometry3D.h"

class BELIMOBlockCreator : public FLM3Geo::BlockCreator3d
{
	public:
		explicit BELIMOBlockCreator( const FLM3Geo::BlockCreator3d &a_rBlockCreator )
			: BlockCreator3d( a_rBlockCreator )  { };

		// Element creation functions
		short makeBELIMO_EV_F();				// EV_F
		short makeBELIMO_EV_R2();				// EV_R2
		short makeBELIMO_EV_R3();				// EV_R3
		short makeBELIMO_D6_N();				// D6_N
		short makeBELIMO_D6_NL();				// D6_NL
		short makeBELIMO_D6_W();				// D6_W
		short makeBELIMO_D6_WL();				// D6_WL
		short makeBELIMO_EP_F();				// EP_F
		short makeBELIMO_EP_R();				// EP_R
		short makeBELIMO_R2_S();				// R2_S_
		short makeBELIMO_R3_S();				// R3_S_
		short makeBELIMO_C2_QFL();				// C2_QFL
		short makeBELIMO_R225FL_J();			// R225FL-J
		short makeBELIMO_C2_QP();				// C2_QP and C2_QPT
		short makeBELIMO_EP_R_R6();				// EP_R6
		//ChungPD
		short makeBELIMO_TA_S_DP();				// TA_S_DP
		short makeBELIMO_XT_701();				// XT701

		// Additional functions
		void makeSimpleBox(const FdPoint3d& center, const FdPoint3d& size, 
				FdVector3d normal, FdVector3d upVector, bool begining = true, bool end = true);
		void makeSimpleBox(const FdPoint3d& center, const FdPoint3d& size, bool begining = true, bool end = true);

		void makeHoles_D6_N_dn25_65(const FdVector3d &normal, const FdVector3d &upVec, const FdPoint3d &startP, 
							double beginWidth, double Height, double dBolt);
		void makeHoles_D6_N(double K, double Height, double dBolt, int nBolt, double alpha1, double alpha);

		void makeDoubleHoles(const FdPoint3d &center1, const FdVector3d &normal, const FdVector3d &upVec,
							double D1, double D2, double length, double c1, double c2);

		void makeSymetricDoubleBend(const FdPoint3d &center, const FdVector3d &normal, const FdVector3d &upVec, bool sides[], bool reverse, 
					double alpha1, double alpha2, double beginWidth, double Height, double endWidth1, double endWidth2, double beginLength, int complexity, 
					double R11, double R12, double endBox, bool endCon);
};

const char *const __GEO_NAME[] =
	{
	  "BELIMO_EV_F"
	 ,"BELIMO_EV_R2"
	 ,"BELIMO_EV_R3"
	 ,"BELIMO_D6_N"
	 ,"BELIMO_D6_NL"
	 ,"BELIMO_D6_W"
	 ,"BELIMO_D6_WL"
	 ,"BELIMO_EP_F"
	 ,"BELIMO_EP_R"
	 ,"BELIMO_R2_S"
	 ,"BELIMO_R3_S"
	 ,"BELIMO_C2_QFL"
	 ,"BELIMO_R225FL_J"
	 ,"BELIMO_C2_QP"
	 ,"BELIMO_EP_R_R6"
	//ChungPD
	 ,"BELIMO_TA_S_DP"
	 ,"BELIMO_XT_701"
	};

typedef short (BELIMOBlockCreator::*const geometry_fn) ();
const geometry_fn __GEO_FN [] =
{
	  &BELIMOBlockCreator::makeBELIMO_EV_F
	 ,&BELIMOBlockCreator::makeBELIMO_EV_R2
	 ,&BELIMOBlockCreator::makeBELIMO_EV_R3
	 ,&BELIMOBlockCreator::makeBELIMO_D6_N
	 ,&BELIMOBlockCreator::makeBELIMO_D6_NL
	 ,&BELIMOBlockCreator::makeBELIMO_D6_W
	 ,&BELIMOBlockCreator::makeBELIMO_D6_WL
	 ,&BELIMOBlockCreator::makeBELIMO_EP_F
	 ,&BELIMOBlockCreator::makeBELIMO_EP_R
	 ,&BELIMOBlockCreator::makeBELIMO_R2_S
	 ,&BELIMOBlockCreator::makeBELIMO_R3_S
	 ,&BELIMOBlockCreator::makeBELIMO_C2_QFL
	 ,&BELIMOBlockCreator::makeBELIMO_R225FL_J
	 ,&BELIMOBlockCreator::makeBELIMO_C2_QP
	 ,&BELIMOBlockCreator::makeBELIMO_EP_R_R6
	//ChungPD 
	 ,&BELIMOBlockCreator::makeBELIMO_TA_S_DP
	 ,&BELIMOBlockCreator::makeBELIMO_XT_701
};

const int __COUNT_FN = sizeof(__GEO_NAME) / sizeof(*__GEO_NAME);

#endif	//__GEO_TGENERAL_H__
