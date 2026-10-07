#ifndef __GEO_COOL_H__
#define __GEO_COOL_H__
#define screw_diam 10
#include "Geo/PnGeometry3D.h"



class GRUNDFOSBlockCreator : public FLM3Geo::BlockCreator3d
{
public:
	explicit GRUNDFOSBlockCreator(const FLM3Geo::BlockCreator3d& a_rBlockCreator)
		: BlockCreator3d(a_rBlockCreator) {
	};
	~GRUNDFOSBlockCreator() {

	};

	short makemagnaMAGNA3();
	short makeMIXIT();

	void makeMAGNA3_FLAGNED();
	void makeMAGNA3();
	void makeSuperBox(FdPoint3d startPoint, FdPoint3d endPoint, FdVector3d normalVector[2], FdVector3d upVector[2], double tabHeight[2], double tabWidth[2]);
	void makeRoundedBox(FdPoint3d startPoint, FdPoint3d endPoint, FdVector3d normalVector, FdVector3d upVector, double tabHeight[2], double tabWidth[2], double radius, bool side[4]);
	void makeFlange(FdPoint3d startP, FdVector3d normalVector, FdVector3d upVector, double thickness, double D1, double D2, double D3, double D4, double D5, double D6, double D7);
protected:

	double GetFlgSize(const char* linkId)
	{
		double ret;  get_fln_size(linkId, ret);  return ret;
	};
	double GetFlgThick(const char* linkId)
	{
		double ret;  get_fln_thick(linkId, ret);  return ret;
	};
	double GetFlgDiam(const char* linkId)
	{
		double ret;  get_fln_diam(linkId, ret);  return ret;
	};

};

const char* const __GEO_NAME[] =
{
	"magnaMAGNA3",
	"MIXIT"
};

typedef short (GRUNDFOSBlockCreator::* const geometry_fn) ();
const geometry_fn __GEO_FN[] =
{

	&GRUNDFOSBlockCreator::makemagnaMAGNA3,
	&GRUNDFOSBlockCreator::makeMIXIT
	
};

const int __COUNT_FN = sizeof(__GEO_NAME) / sizeof(*__GEO_NAME);

inline void setpt(ads_point p, ads_real x, ads_real y, ads_real z, int kx)
{
	setpt(p, kx * x, y, z);
};

inline void setpt(ads_point p, ads_real x, ads_real y, ads_real z, int kx, int ky)
{
	setpt(p, kx * x, ky * y, z);
};

#endif
