// Link connector tests (buildConnectorPreview): Circular and Rectangular in
// every orientation, a/b/gamma angles, names, and rejected field values.
//@connector Circular|XPositive|100|||0,0,0|0,0,0
//@connector Circular|XNegative|80.5|||10,-20,30|15,0,0|inlet
//@connector Circular|YPositive|60|||-5,5,0|0,30,0||linkIn
//@connector Circular|YNegative|40|||0,0,100|0,0,45|out|linkOut
//@connector Circular|ZPositive|25|||1,2,3|10,20,30
//@connector Circular|ZNegative|200|||0,0,0|90,0,0
//@connector Rectangular|XPositive||120|60|0,0,0|0,0,0
//@connector Rectangular|XNegative||50|150|100,0,0|0,0,90|wide
//@connector Rectangular|YPositive||80|40|0,250,0|30,0,0
//@connector Rectangular|YNegative||35.5|20.25|0,-10,5|0,-60,0
//@connector Rectangular|ZPositive||300|100|0,0,500|45,45,45|top|topLink
//@connector Rectangular|ZNegative||10|10|-1,-1,-1|0,0,-120
//@connector Circular|XPositive||||0,0,0|0,0,0
//@connector Circular|XPositive|0|||0,0,0|0,0,0
//@connector Circular|XPositive|-10|||0,0,0|0,0,0
//@connector Circular|XPositive|0.0000005|||0,0,0|0,0,0
//@connector Circular|XPositive|1e9|||0,0,0|0,0,0
//@connector Rectangular|ZNegative||120||0,0,0|0,0,0
//@connector Rectangular|ZNegative|||60|0,0,0|0,0,0
//@connector Rectangular|YPositive||120|60|0,200000000,0|0,0,0
//@connector Circular|YPositive|50|||0,0,|0,0,0
//@connector Circular|YPositive|50|||0,0,0|0,1e9,0
//@connector Circular|XNegative|99999999|||0,0,0|0,0,0
//@connector Rectangular|XPositive||0.5*W|W|0,0,0|0,0,0
double W = 240;
makeVerySimpleTube(FdPoint3d(0, 0, 0), FdPoint3d(0, 0, W), 50, 2);
